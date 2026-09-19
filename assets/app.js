(function runYimingQianNian() {
  "use strict";
  const model = window.YMQNModel;
  const songs = window.YMQNSongs;
  const audio = new window.YMQNAudio.BellAudioEngine();
  const VISUAL = Object.freeze({
    palette: Object.freeze({ night: "#080e0c", lacquer: "#4c1915", lacquerHighlight: "#722b22", oldGold: "#c6aa68", rice: "#ede2c9", inscription: "#202b25", inscriptionText: "#c7b27a" }),
    layout: Object.freeze({ landscapeRatio: 1.35, navRailPx: 0, controlRailPx: 184, navDockHeightPx: 58 })
  });
  window.YMQNVisualConfig = VISUAL;
  window.YMQNVisualRoles = VISUAL.palette;
  const LISTEN_RATE = 0.90;
  const FOLLOW_RATE = 0.72;
  const FOLLOW_RATE_LABEL = "0.72×";
  const visualAssets = {};
  const visualSources = {
    top: "./assets/images/bell-small-v2.webp",
    middle: "./assets/images/bell-medium-v2.webp",
    bottom: "./assets/images/bell-large-v2.webp",
    mallet: "./assets/images/bell-mallet-v10.webp"
  };
  Object.entries(visualSources).forEach(([key, source]) => {
    const image = new Image();
    image.decoding = "async";
    image.addEventListener("load", resizeAll);
    image.src = source;
    visualAssets[key] = image;
  });
  const keys = { settings: "ymqn:v1:settings", progress: "ymqn:v1:progress", works: "ymqn:v1:works" };
  const defaults = { volume: 0.78, tuningMode: "pentatonic", showLabels: true, reduceMotion: false };
  const activePointers = new Map();
  const debounce = new Map();
  const renderStages = [];
  let settings = loadJson(keys.settings, defaults);
  let progress = loadJson(keys.progress, { tutorialDone: false, bestScores: {}, recentSongId: null });
  let works = model.parseStoredWorks(safeGet(keys.works));
  let currentView = "play";
  let previousView = "play";
  let selectedSong = songs[0];
  let recording = null;
  let recordingClock = 0;
  let playbackTimers = [];
  let listenTimer = null;
  let follow = null;
  const DRAW_INTERVAL = 1000 / 30;
  let animationFrame = 0;
  let lastDrawAt = 0;
  let resizeFrame = 0;
  let recordingTimer = 0;
  const performanceState = { frames: 0, draws: 0, drawFps: 30, mobileDprCap: 1.5 };
  window.YMQNPerformanceState = performanceState;
  document.documentElement.dataset.ymqnPerformance = "30fps-1.5dpr-12voices";

  const elements = {
    shell: document.getElementById("app-shell"), boot: document.getElementById("boot-screen"), app: document.getElementById("main-app"),
    unlock: document.getElementById("unlock-audio"), bootBell: document.getElementById("boot-bell"), bootNote: document.getElementById("boot-note"), bootStatus: document.getElementById("boot-status"), modeButton: document.getElementById("mode-button"),
    modeMenu: document.getElementById("mode-menu"), note: document.getElementById("note-readout"), noteName: document.getElementById("note-name"), notePitch: document.getElementById("note-pitch"), labelsButton: document.getElementById("labels-button"),
    recordButton: document.getElementById("record-button"), bottomNav: document.getElementById("bottom-nav"), songList: document.getElementById("song-list"),
    worksList: document.getElementById("works-list"), worksCount: document.getElementById("works-count"), songSheet: document.getElementById("song-sheet"),
    recordSheet: document.getElementById("record-sheet"), settingsSheet: document.getElementById("settings-sheet"), toast: document.getElementById("toast"),
    guide: document.getElementById("first-guide"), followTitle: document.getElementById("follow-title"), followProgress: document.getElementById("follow-progress"),
    followBar: document.getElementById("follow-progress-bar"), futureNotes: document.getElementById("future-notes"), followBeat: document.getElementById("follow-beat"), judgement: document.getElementById("judgement"),
    knowledgeBell: document.getElementById("knowledge-bell"), cultureHit: document.getElementById("culture-hit")
  };

  function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function loadJson(key, fallback) { try { return Object.assign({}, fallback, JSON.parse(safeGet(key) || "{}")); } catch { return Object.assign({}, fallback); } }
  function saveJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { toast("当前记录可以继续，但暂时无法保存到设备"); return false; } }
  function persistSettings() { saveJson(keys.settings, settings); }
  function setAppHeight(){const viewport=window.visualViewport;const height=viewport&&viewport.height?Math.round(viewport.height):window.innerHeight;document.documentElement.style.setProperty("--app-height",`${height}px`);resizeAll();}
  function scheduleResize() { window.cancelAnimationFrame(resizeFrame); resizeFrame = window.requestAnimationFrame(setAppHeight); }
  function formatTime(milliseconds) { const seconds = Math.max(0, Math.floor(milliseconds / 1000)); return `${String(Math.floor(seconds / 60)).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`; }
  function toast(message) { elements.toast.textContent = message; elements.toast.classList.add("is-visible"); window.clearTimeout(toast.timer); toast.timer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 1700); }

  function makeStage(rackCanvas, bellCanvas, kind) {
    const stage = { rackCanvas, bellCanvas, kind, rackContext: rackCanvas.getContext("2d"), context: bellCanvas.getContext("2d"), layouts: [], effects: [], activeBell: null, target: null };
    renderStages.push(stage);
    for (const event of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) bellCanvas.addEventListener(event, (pointerEvent) => handlePointer(stage, pointerEvent));
    return stage;
  }
  const mainStage = makeStage(document.getElementById("rack-canvas"), document.getElementById("bell-canvas"), "play");
  const followStage = makeStage(document.getElementById("follow-rack-canvas"), document.getElementById("follow-canvas"), "follow");

  function isRotatedFollow(stage) { return stage.kind === "follow" && document.body.classList.contains("follow-landscape") && window.matchMedia("(orientation: portrait)").matches; }
  function resizeCanvas(canvas, context, internallyRotated) {
    const rect = canvas.getBoundingClientRect();
    const width = internallyRotated ? canvas.offsetWidth : rect.width;
    const height = internallyRotated ? canvas.offsetHeight : rect.height;
    if (!width || !height) return null;
    const dpr = Math.min(window.innerWidth <= 900 ? 1.5 : 2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    context.setTransform(dpr,0,0,dpr,0,0);
    return { width, height };
  }
  function resizeStage(stage) {
    const internallyRotated = isRotatedFollow(stage);
    const rackSize = resizeCanvas(stage.rackCanvas, stage.rackContext, internallyRotated);
    const bellSize = resizeCanvas(stage.bellCanvas, stage.context, internallyRotated);
    if (!rackSize || !bellSize) return;
    stage.size = bellSize;
    stage.layouts = buildLayout(bellSize.width, bellSize.height);
    drawRack(stage);
    drawStage(stage, performance.now());
  }
  function resizeAll() { renderStages.forEach(resizeStage); }

  function buildLayout(width, height) {
    const layouts = [];
    const rows = [
      { name: "top", bells: model.BELLS.filter((bell) => bell.row === "top"), y: height * .12, height: height * .205 },
      { name: "middle", bells: model.BELLS.filter((bell) => bell.row === "middle"), y: height * .38, height: height * .245 },
      { name: "bottom", bells: model.BELLS.filter((bell) => bell.row === "bottom"), y: height * .68, height: height * .28 }
    ];
    rows.forEach((row) => {
      const usable = width - 58; const gap = 5; const bellWidth = (usable - gap * 3) / 4;
      row.bells.forEach((bell, index) => {
        const x = 29 + index * (bellWidth + gap);
        const polygon = [[x+bellWidth*.36,row.y],[x+bellWidth*.64,row.y],[x+bellWidth*.76,row.y+row.height*.16],[x+bellWidth*.98,row.y+row.height*.88],[x+bellWidth*.84,row.y+row.height],[x+bellWidth*.16,row.y+row.height],[x+bellWidth*.02,row.y+row.height*.88],[x+bellWidth*.24,row.y+row.height*.16]];
        layouts.push({ bell, x, y: row.y, width: bellWidth, height: row.height, polygon, row: row.name });
      });
    });
    return layouts;
  }
  function drawRack(stage) {
    if (!stage.size) return;
    const ctx = stage.rackContext; const { width, height } = stage.size;
    ctx.clearRect(0,0,width,height);
    const landscape=width/height>VISUAL.layout.landscapeRatio,postWidth=landscape?11:15,beamHeight=landscape?7:10,postInset=landscape?12:13;
    const wood=ctx.createLinearGradient(0,0,width,0);wood.addColorStop(0,"#120706");wood.addColorStop(.28,"#30100e");wood.addColorStop(.5,"#582019");wood.addColorStop(.72,"#2e100d");wood.addColorStop(1,"#100504");
    const floorGlow=ctx.createRadialGradient(width*.5,height*.88,2,width*.5,height*.88,width*.42);floorGlow.addColorStop(0,"rgba(198,170,104,.11)");floorGlow.addColorStop(.45,"rgba(79,117,105,.055)");floorGlow.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=floorGlow;ctx.fillRect(0,height*.55,width,height*.45);
    ctx.shadowColor="rgba(0,0,0,.58)";ctx.shadowBlur=8;ctx.fillStyle=wood;ctx.strokeStyle="rgba(157,132,78,.42)";ctx.lineWidth=.8;
    for(const x of [postInset,width-postInset-postWidth]){roundRect(ctx,x,height*.035,postWidth,height*.94,landscape?3:7);ctx.fill();ctx.stroke();ctx.fillStyle="rgba(198,170,104,.11)";roundRect(ctx,x+postWidth*.42,height*.05,2,height*.9,1);ctx.fill();ctx.fillStyle=wood;}
    [height*.102,height*.362,height*.662].forEach((y,rowIndex)=>{roundRect(ctx,postInset+5,y,width-(postInset+5)*2,beamHeight,2);ctx.fillStyle=wood;ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle="rgba(198,170,104,.2)";ctx.beginPath();ctx.moveTo(postInset+13,y+2);ctx.lineTo(width-postInset-13,y+2);ctx.stroke();stage.layouts.filter((layout)=>["top","middle","bottom"][rowIndex]===layout.row).forEach((layout)=>{const cx=layout.x+layout.width/2;ctx.fillStyle="#17100a";ctx.beginPath();ctx.arc(cx,y+beamHeight,landscape?2.6:3.6,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(165,139,80,.56)";ctx.stroke();});ctx.shadowBlur=8;});
    ctx.shadowBlur=0;ctx.strokeStyle="rgba(198,170,104,.16)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(postInset+postWidth,height*.945);ctx.lineTo(width-postInset-postWidth,height*.945);ctx.stroke();
    for(const x of [postInset+postWidth*.5,width-postInset-postWidth*.5]){ctx.fillStyle="rgba(17,6,5,.92)";ctx.beginPath();ctx.moveTo(x-10,height*.965);ctx.lineTo(x+10,height*.965);ctx.lineTo(x+15,height*.985);ctx.lineTo(x-15,height*.985);ctx.closePath();ctx.fill();ctx.stroke();}
    ctx.shadowBlur=0;
  }
  function roundRect(ctx,x,y,w,h,r) { ctx.beginPath(); ctx.roundRect(x,y,w,h,r); }
  function pointInPolygon(x,y,polygon) {
    let inside = false;
    for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
      const xi=polygon[i][0], yi=polygon[i][1], xj=polygon[j][0], yj=polygon[j][1];
      if ((yi>y)!==(yj>y) && x < (xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
    }
    return inside;
  }
  function findHit(stage,x,y) {
    const candidates = stage.layouts.filter((layout) => pointInPolygon(x,y,layout.polygon) || (x>=layout.x-6&&x<=layout.x+layout.width+6&&y>=layout.y-6&&y<=layout.y+layout.height+6));
    if (!candidates.length) return null;
    candidates.sort((a,b) => Math.hypot(x-(a.x+a.width/2),y-(a.y+a.height/2))-Math.hypot(x-(b.x+b.width/2),y-(b.y+b.height/2)));
    const layout = candidates[0]; const zone = model.resolveZone((x-layout.x)/layout.width);
    return zone ? { layout, zone, x, y } : null;
  }
  function handlePointer(stage,event) {
    const rect = stage.bellCanvas.getBoundingClientRect();
    const screenX=event.clientX-rect.left,screenY=event.clientY-rect.top;
    const point = isRotatedFollow(stage) ? { x:screenY, y:stage.size.height-screenX } : { x:screenX, y:screenY };
    if (event.type === "pointerdown") {
      event.preventDefault();
      try { stage.bellCanvas.setPointerCapture(event.pointerId); } catch { /* 指针已释放 */ }
      activePointers.set(event.pointerId,{ stage, point });
      const hit = findHit(stage,point.x,point.y); if (hit) strike(hit,stage,"user");
    } else if (event.type === "pointermove") {
      if (activePointers.has(event.pointerId)) activePointers.set(event.pointerId,{ stage, point });
    } else if (event.type === "pointerup" || event.type === "pointercancel") {
      activePointers.delete(event.pointerId);
      if (stage.bellCanvas.hasPointerCapture(event.pointerId)) stage.bellCanvas.releasePointerCapture(event.pointerId);
    }
  }
  function strike(hit,stage,source,scheduledMidi,scheduledVelocity) {
    const rawMidi = hit.zone === "center" ? hit.layout.bell.centerMidi : hit.layout.bell.sideMidi;
    const activeMode = follow && stage.kind === "follow" ? follow.song.mode : settings.tuningMode;
    const resolvedMidi = Number.isFinite(scheduledMidi) ? scheduledMidi : activeMode === "pentatonic" ? model.quantizePentatonic(rawMidi) : rawMidi;
    const now = performance.now(); const key = `${hit.layout.bell.id}:${hit.zone}`;
    if (source === "user" && now-(debounce.get(key)||0)<35) return;
    const velocity = Number.isFinite(scheduledVelocity) ? scheduledVelocity : source === "system" ? .55 : .86;
    debounce.set(key,now); audio.play(resolvedMidi,velocity);
    stage.activeBell = { id:hit.layout.bell.id, zone:hit.zone, startedAt:now };
    stage.effects.push({ x:hit.x,y:hit.y,zone:hit.zone,direction:hit.x<(hit.layout.x+hit.layout.width/2)?-1:1,startedAt:now,source });
    requestRender();
    elements.noteName.textContent = model.displayNote(resolvedMidi,activeMode);
    elements.notePitch.textContent = `${hit.layout.bell.id} · ${hit.zone === "center" ? "正鼓" : "侧鼓"} · ${model.midiName(resolvedMidi)}`;
    elements.note.classList.remove("is-ringing","is-center-hit","is-side-hit");
    void elements.note.offsetWidth;
    elements.note.classList.add("is-ringing",hit.zone === "center" ? "is-center-hit" : "is-side-hit");
    const stageElement = stage.bellCanvas.parentElement;
    stageElement.classList.remove("is-struck");
    void stageElement.offsetWidth;
    stageElement.classList.add("is-struck");
    if (recording && source === "user" && stage.kind === "play") recording = model.recordStrike(recording,{ now, bellId:hit.layout.bell.id, zone:hit.zone, resolvedMidi, velocity:.86 });
    if (follow && source === "user" && stage.kind === "follow") scoreFollowStrike(resolvedMidi,now);
    if (!progress.tutorialDone && source === "user" && stage.kind === "play") completeTutorial();
  }
  function drawStage(stage,now) {
    if (!stage.size) return;
    const ctx=stage.context,{width,height}=stage.size; ctx.clearRect(0,0,width,height);
    stage.layouts.forEach((layout) => drawBell(ctx,layout,stage,now));
    stage.effects = stage.effects.filter((effect) => now-effect.startedAt<850);
    stage.effects.forEach((effect) => drawEffect(ctx,effect,now));
  }
  function drawBell(ctx,layout,stage,now) {
    const active = stage.activeBell && stage.activeBell.id===layout.bell.id ? Math.max(0,1-(now-stage.activeBell.startedAt)/820) : 0;
    const target = stage.target && stage.target.bellId===layout.bell.id;
    const swing = settings.reduceMotion?0:Math.sin((now-(stage.activeBell?.startedAt||now))*.014)*active*(layout.row==="top"?.012:layout.row==="middle"?.009:.006);
    ctx.save(); ctx.translate(layout.x+layout.width/2,layout.y); ctx.rotate(swing); ctx.translate(-(layout.x+layout.width/2),-layout.y);
    const image=visualAssets[layout.row];
    if(image&&image.complete&&image.naturalWidth){const scale=Math.min(layout.width/image.naturalWidth,layout.height/image.naturalHeight);const drawWidth=image.naturalWidth*scale,drawHeight=image.naturalHeight*scale;const drawX=layout.x+(layout.width-drawWidth)/2,drawY=layout.y+(layout.height-drawHeight)*.08;if(active){ctx.filter=`brightness(${1+active*.34}) saturate(${1+active*.16})`;ctx.shadowColor="rgba(197,164,93,.56)";ctx.shadowBlur=14;}ctx.drawImage(image,drawX,drawY,drawWidth,drawHeight);ctx.filter="none";ctx.shadowBlur=0;}else{const gradient=ctx.createLinearGradient(layout.x,layout.y,layout.x+layout.width,layout.y);gradient.addColorStop(0,"#32423b");gradient.addColorStop(.5,active?"#b1aa7c":"#73745d");gradient.addColorStop(1,"#2f4039");ctx.beginPath();layout.polygon.forEach((point,index)=>index?ctx.lineTo(point[0],point[1]):ctx.moveTo(point[0],point[1]));ctx.closePath();ctx.fillStyle=gradient;ctx.fill();}
    if(target){const tx=stage.target.zone==="center"?layout.x+layout.width*.5:layout.x+layout.width*.2,ty=layout.y+layout.height*.56,radius=Math.max(10,layout.width*.14);ctx.fillStyle="rgba(197,164,93,.25)";ctx.beginPath();ctx.arc(tx,ty,radius,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#c5a45d";ctx.lineWidth=2.2;ctx.stroke();}
    if(settings.showLabels){
      const activeMode=follow&&stage.kind==="follow"?follow.song.mode:settings.tuningMode;
      const resolve=(midi)=>activeMode==="pentatonic"?model.quantizePentatonic(midi):midi;
      const badgeSize=Math.max(7.2,Math.min(9.2,layout.width*.085));
      const activeZone=active&&stage.activeBell?.zone;
      const targetZone=target&&stage.target?.zone;
      const sideHighlighted=activeZone==="side"||targetZone==="side";
      const centerHighlighted=activeZone==="center"||targetZone==="center";
      drawNoteBadge(ctx,model.midiName(resolve(layout.bell.sideMidi)),layout.x+layout.width*.17,layout.y+layout.height*.76,badgeSize,false,"left",sideHighlighted);
      drawNoteBadge(ctx,model.midiName(resolve(layout.bell.sideMidi)),layout.x+layout.width*.83,layout.y+layout.height*.76,badgeSize,false,"right",sideHighlighted);
      drawNoteBadge(ctx,model.midiName(resolve(layout.bell.centerMidi)),layout.x+layout.width*.5,layout.y+layout.height*.15,badgeSize,true,"center",centerHighlighted);
      ctx.fillStyle="rgba(238,226,199,.72)";ctx.font=`600 ${Math.max(8,layout.width*.09)}px system-ui`;ctx.textAlign="center";ctx.shadowColor="rgba(0,0,0,.85)";ctx.shadowBlur=4;ctx.fillText(layout.bell.id,layout.x+layout.width/2,layout.y+layout.height*.92);ctx.shadowBlur=0;
    }
    ctx.restore();
  }
  function drawNoteBadge(ctx,text,x,y,fontSize,isCenter,anchor,highlighted){
    const displayFont=isCenter?fontSize*.9:fontSize*.72;ctx.save();ctx.font=`700 ${displayFont}px Georgia,serif`;ctx.textAlign="center";ctx.textBaseline="middle";
    const width=Math.max(isCenter?22:16,ctx.measureText(text).width+(isCenter?7:5)),height=Math.max(isCenter?14:11,displayFont+(isCenter?5:4)),top=y-height/2,left=x-width/2,cut=isCenter?3.2:height*.34;
    ctx.strokeStyle=highlighted?"rgba(224,199,125,.82)":"rgba(117,100,59,.48)";ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(x-2.5,top);ctx.lineTo(x-2.5,top-(isCenter?3:2));ctx.lineTo(x+2.5,top-(isCenter?3:2));ctx.lineTo(x+2.5,top);ctx.stroke();
    const trace=(inset)=>{const l=left+inset,t=top+inset,w=width-inset*2,h=height-inset*2,c=Math.max(1,cut-inset*.45);ctx.beginPath();ctx.moveTo(l+c,t);ctx.lineTo(l+w-c,t);ctx.lineTo(l+w,t+c);ctx.lineTo(l+w,t+h-c);ctx.lineTo(l+w-c,t+h);ctx.lineTo(l+c,t+h);ctx.lineTo(l,t+h-c);ctx.lineTo(l,t+c);ctx.closePath();};
    const metal=ctx.createLinearGradient(left,top,left+width,top+height);
    if(highlighted){metal.addColorStop(0,"#765523");metal.addColorStop(.46,"#d0ad60");metal.addColorStop(1,"#624419");ctx.shadowColor="rgba(210,177,94,.66)";ctx.shadowBlur=9;}else{metal.addColorStop(0,"#29342d");metal.addColorStop(.52,VISUAL.palette.inscription);metal.addColorStop(1,"#111815");ctx.shadowColor="rgba(0,0,0,.64)";ctx.shadowBlur=2;}
    trace(0);ctx.fillStyle=metal;ctx.fill();ctx.strokeStyle=highlighted?"rgba(230,205,134,.86)":"rgba(117,100,59,.5)";ctx.lineWidth=.65;ctx.stroke();ctx.shadowBlur=0;
    trace(2);ctx.strokeStyle=highlighted?"rgba(72,49,19,.62)":"rgba(178,151,82,.2)";ctx.lineWidth=.55;ctx.stroke();
    ctx.fillStyle=highlighted?"#24180b":VISUAL.palette.inscriptionText;ctx.globalAlpha=highlighted?1:.72;ctx.fillText(text,x,y+.25);ctx.restore();
  }
  function drawEffect(ctx,effect,now){
    const age=(now-effect.startedAt)/850;
    if(settings.reduceMotion&&age>.18)return;
    const fade=Math.max(0,1-age);
    ctx.save();
    const glow=ctx.createRadialGradient(effect.x,effect.y,0,effect.x,effect.y,32+age*36);glow.addColorStop(0,`rgba(238,211,139,${.34*fade})`);glow.addColorStop(.36,`rgba(198,170,104,${.13*fade})`);glow.addColorStop(1,"rgba(198,170,104,0)");ctx.fillStyle=glow;ctx.beginPath();ctx.arc(effect.x,effect.y,34+age*34,0,Math.PI*2);ctx.fill();
    [0,13].forEach((offset)=>{ctx.globalAlpha=fade*(offset? .34:.72);ctx.strokeStyle=VISUAL.palette.oldGold;ctx.lineWidth=offset?1:1.45;ctx.beginPath();ctx.arc(effect.x,effect.y,8+offset+age*(38+offset),0,Math.PI*2);ctx.stroke();});
    ctx.globalAlpha=fade*.78;ctx.strokeStyle="rgba(238,211,139,.92)";ctx.lineWidth=1.25;ctx.beginPath();for(let point=-34;point<=34;point+=2){const waveY=effect.y+Math.sin((point+age*70)*.28)*(7+age*4)*(1-Math.abs(point)/42);point===-34?ctx.moveTo(effect.x+point,waveY):ctx.lineTo(effect.x+point,waveY);}ctx.stroke();
    if(!settings.reduceMotion){ctx.globalAlpha=fade*.48;ctx.strokeStyle="rgba(238,226,199,.82)";ctx.lineWidth=.8;for(let ray=0;ray<8;ray+=1){const angle=ray*Math.PI/4+(effect.direction||1)*.08;const inner=12+age*9,outer=18+age*25;ctx.beginPath();ctx.moveTo(effect.x+Math.cos(angle)*inner,effect.y+Math.sin(angle)*inner);ctx.lineTo(effect.x+Math.cos(angle)*outer,effect.y+Math.sin(angle)*outer);ctx.stroke();}}
    const mallet=visualAssets.mallet;
    if(effect.source==="user"&&mallet&&mallet.complete&&mallet.naturalWidth){const strike=Math.min(1,age/.25),rebound=age>.25?(age-.25)/.75:0,ease=1-Math.pow(1-strike,3),drawHeight=128,drawWidth=mallet.naturalWidth/mallet.naturalHeight*drawHeight,side=effect.direction||1;ctx.globalAlpha=settings.reduceMotion?.72:Math.max(0,1-age*1.08);ctx.translate(effect.x+side*((1-ease)*34+rebound*25),effect.y+(1-ease)*40+rebound*24);ctx.rotate(side*((1-ease)*.18-.045+rebound*.12));ctx.drawImage(mallet,-drawWidth/2,-drawHeight*.11,drawWidth,drawHeight);}
    ctx.restore();
  }
  function requestRender(){if(!animationFrame&&!document.hidden)animationFrame=window.requestAnimationFrame(frame);}
  function frame(now){animationFrame=0;performanceState.frames+=1;updateFollow(now);const stage=currentView==="follow"?followStage:currentView==="play"?mainStage:null;if(stage&&now-lastDrawAt>=DRAW_INTERVAL-1){drawStage(stage,now);lastDrawAt=now;performanceState.draws+=1;}const moving=stage&&(stage.effects.length||(stage.activeBell&&now-stage.activeBell.startedAt<850));if(moving||(follow&&!follow.paused&&currentView==="follow"))requestRender();}

  async function previewBootBell(event){
    const rect=elements.bootBell.getBoundingClientRect(),ratio=(event.clientX-rect.left)/rect.width,center=ratio>.34&&ratio<.72,midi=center?60:64;
    try{await audio.unlock();audio.play(midi,.78);elements.bootNote.textContent=`已敲 · ${center?"正鼓":"侧鼓"} ${model.midiName(midi)}`;elements.bootBell.classList.remove("is-struck");void elements.bootBell.offsetWidth;elements.bootBell.classList.add("is-struck");}catch(error){console.error(error);}
  }
  async function previewKnowledgeBell(event){const rect=elements.knowledgeBell.getBoundingClientRect(),center=(event.clientX-rect.left)/rect.width>.34&&(event.clientX-rect.left)/rect.width<.72,midi=center?60:64;try{await audio.unlock();audio.play(midi,.78);elements.cultureHit.lastChild.textContent=`已敲 · ${center?"正鼓":"侧鼓"} ${model.midiName(midi)}`;elements.cultureHit.classList.remove("is-ringing");elements.knowledgeBell.classList.remove("is-struck");void elements.cultureHit.offsetWidth;elements.cultureHit.classList.add("is-ringing");elements.knowledgeBell.classList.add("is-struck");}catch(error){console.error(error);}}
  async function unlockAudio(){elements.unlock.disabled=true;elements.unlock.textContent="正在启钟…";elements.bootStatus.hidden=false;elements.bootStatus.textContent="声音正在准备，请稍候";try{await audio.unlock();audio.play(55,.72);document.body.classList.add("play-requested");elements.boot.hidden=true;elements.app.hidden=false;resizeAll();if(!progress.tutorialDone)elements.guide.hidden=false;}catch(error){console.error(error);elements.unlock.disabled=false;elements.unlock.textContent="重新启钟";elements.bootStatus.hidden=false;elements.bootStatus.textContent="暂时无法启音，请轻触重试";}}
  function openView(view){stopListening();if(currentView==="culture")previousView="play";else previousView=currentView;currentView=view;document.querySelectorAll("[data-view]").forEach((panel)=>{const active=panel.dataset.view===view;panel.hidden=!active;panel.classList.toggle("is-active",active);});const primary=["play","library","works"].includes(view);elements.bottomNav.hidden=!primary;elements.bottomNav.querySelectorAll("button").forEach((button)=>button.classList.toggle("is-active",button.dataset.openView===view));window.setTimeout(resizeAll,20);if(view==="works")renderWorks();}
  function completeTutorial(){progress.tutorialDone=true;saveJson(keys.progress,progress);elements.guide.hidden=true;toast("试试敲同一口钟的中央和两侧");}
  function setMode(mode){settings.tuningMode=mode;elements.modeButton.textContent=mode==="pentatonic"?"五声易奏":"全律演奏";elements.modeMenu.hidden=true;elements.modeButton.setAttribute("aria-expanded","false");persistSettings();toast(mode==="pentatonic"?"随手敲也更容易成曲":"已开放完整十二音");}

  function playbackDurationMs(song){const timeline=song.listenEvents||song.events;const lastBeat=timeline.reduce((max,event)=>Math.max(max,event.beat+event.durationBeat),0);return Math.round(lastBeat*60000/song.bpm/LISTEN_RATE);}
  function renderSongs(category){const list=category&&category!=="全部"?songs.filter((song)=>song.category===category):songs;elements.songList.innerHTML=list.map((song)=>`<button class="song-row" type="button" data-song-id="${song.id}"><span class="song-row-copy"><strong>${song.title}</strong><small>${song.category} · ${Math.max(1,Math.round(playbackDurationMs(song)/1000))} 秒 · ${song.mode==="pentatonic"?"五声易奏":"全律演奏"}</small></span><span class="song-row-end"><i>${"★".repeat(song.difficulty)}</i><b aria-hidden="true">›</b></span></button>`).join("");}
  function openSongSheet(song){selectedSong=song;document.getElementById("song-sheet-category").textContent=song.category;document.getElementById("song-sheet-title").textContent=song.title;document.getElementById("song-sheet-description").textContent=song.description;document.getElementById("song-sheet-facts").innerHTML=`<span>难度 ${"★".repeat(song.difficulty)}</span><span>试听约 ${Math.max(1,Math.round(playbackDurationMs(song)/1000))} 秒</span><span>跟奏 ${FOLLOW_RATE_LABEL}</span><span>${song.mode==="pentatonic"?"五声易奏":"全律演奏"}</span><span>${song.rightsStatus}</span>`;elements.songSheet.hidden=false;}
  function closeSongSheet(){elements.songSheet.hidden=true;}
  function stopPlaybackTimers(){playbackTimers.forEach((timer)=>clearTimeout(timer));playbackTimers=[];}
  function stopListening(){if(listenTimer){clearInterval(listenTimer);listenTimer=null;}stopPlaybackTimers();mainStage.target=null;}
  function startListening(song){closeSongSheet();openView("play");stopListening();audio.unlock();const timeline=song.listenEvents||song.events;const durationMs=playbackDurationMs(song);const start=performance.now()+420;let index=0;listenTimer=setInterval(()=>{const elapsed=performance.now()-start;while(index<timeline.length){const event=timeline[index];const eventMs=event.beat*60000/song.bpm/LISTEN_RATE;if(eventMs>elapsed+130)break;scheduleSystemEvent(event,eventMs-elapsed,mainStage);index+=1;}if(index>=timeline.length&&elapsed>durationMs+650){stopListening();toast("听赏结束，现在可以接着自己敲");}},25);toast(`保留原曲节拍 · ${LISTEN_RATE.toFixed(2)}× 听赏《${song.title}》`);}
  function scheduleSystemEvent(event,delay,stage){const layoutInfo=model.resolveNoteLayout(event.midi);if(!layoutInfo)return;const layout=stage.layouts.find((item)=>item.bell.id===layoutInfo.bellId);if(!layout)return;const wait=Math.max(0,delay);playbackTimers.push(setTimeout(()=>{stage.target={...layoutInfo,zone:layoutInfo.zone};strike({layout,zone:layoutInfo.zone,x:layout.x+layout.width*(layoutInfo.zone==="center"?.5:.18),y:layout.y+layout.height*.58},stage,"system",event.midi,event.velocity);playbackTimers.push(setTimeout(()=>{if(stage.target&&stage.target.bellId===layoutInfo.bellId)stage.target=null;},Math.max(260,event.durationBeat*60000/(selectedSong?.bpm||82)/LISTEN_RATE*.72)));},wait));}

  let followRotateHinted=false;
  function hintFollowRotate(){if(followRotateHinted)return;followRotateHinted=true;toast("浏览器不允许网页锁定方向，请手动横屏，编钟会铺满");}
  function enterFollowLandscape(){document.body.classList.add("follow-landscape");const orientation=window.screen&&window.screen.orientation;if(orientation&&typeof orientation.lock==="function")Promise.resolve(orientation.lock("landscape")).catch(hintFollowRotate);else hintFollowRotate();window.setTimeout(resizeAll,40);}
  function leaveFollowLandscape(){document.body.classList.remove("follow-landscape");const orientation=window.screen&&window.screen.orientation;if(orientation&&typeof orientation.unlock==="function")orientation.unlock();window.setTimeout(resizeAll,40);}
  function startFollow(song){closeSongSheet();stopListening();selectedSong=song;const beatMs=60000/song.bpm/FOLLOW_RATE;follow={song,index:0,attempts:[],startedAt:performance.now()+beatMs*4,beatMs,lastBeat:-1,paused:false,pauseAt:0,originalMode:settings.tuningMode};setMode(song.mode);elements.followTitle.textContent=song.title;elements.judgement.textContent="四拍预备 · 跟着节拍光点落槌";enterFollowLandscape();openView("follow");updateFutureNotes();updateBeatIndicator(-1);requestRender();}
  function currentFollowEvent(){return follow?follow.song.events[follow.index]:null;}
  function eventTargetTime(event){return follow.startedAt+event.beat*60000/follow.song.bpm/FOLLOW_RATE;}
  function updateBeatIndicator(beat){Array.from(elements.followBeat.children).forEach((dot,index)=>dot.classList.toggle("is-active",index===beat));}
  function updateFollow(now){if(!follow||follow.paused||currentView!=="follow")return;const event=currentFollowEvent();if(!event)return;const target=model.resolveNoteLayout(event.midi);followStage.target={...target,zone:target.zone};const relative=now-follow.startedAt;if(relative<0){const remaining=Math.max(1,Math.ceil(-relative/follow.beatMs));const beat=4-remaining;if(beat!==follow.lastBeat){follow.lastBeat=beat;updateBeatIndicator(beat);elements.judgement.textContent=`预备 ${remaining} · 看准 ${target.bellId} ${target.zone==="center"?"正鼓":"侧鼓"}`;}return;}const beat=Math.floor(relative/follow.beatMs)%4;if(beat!==follow.lastBeat){follow.lastBeat=beat;updateBeatIndicator(beat);}const targetTime=eventTargetTime(event);if(now>targetTime+540){follow.attempts.push({label:"失拍",points:0,pitchCorrect:false});elements.judgement.textContent=`${target.bellId} · ${target.zone==="center"?"正鼓":"侧鼓"} · 失拍`;advanceFollow("失拍");}}
  function scoreFollowStrike(actualMidi,now){const event=currentFollowEvent();if(!event)return;const target=model.resolveNoteLayout(event.midi);const attempt=model.scoreAttempt({expectedMidi:event.midi,actualMidi,deltaMs:now-eventTargetTime(event)});follow.attempts.push(attempt);elements.judgement.textContent=`${target.bellId} · ${target.zone==="center"?"正鼓":"侧鼓"} · ${model.midiName(event.midi)} · ${attempt.label}`;advanceFollow(attempt.label);}
  function advanceFollow(lastLabel){follow.index+=1;elements.followProgress.textContent=`${follow.index}/${follow.song.events.length} · ${FOLLOW_RATE_LABEL}`;elements.followBar.style.width=`${follow.index/follow.song.events.length*100}%`;if(follow.index>=follow.song.events.length){finishFollow();return;}updateFutureNotes();const next=currentFollowEvent(),target=model.resolveNoteLayout(next.midi);elements.judgement.textContent=`${lastLabel||"继续"} · 下一音 ${target.bellId} ${target.zone==="center"?"正鼓":"侧鼓"} ${model.midiName(next.midi)}`;}
  function updateFutureNotes(){if(!follow)return;const upcoming=follow.song.events.slice(follow.index,follow.index+3);elements.futureNotes.innerHTML=upcoming.map((event)=>`<span>${model.midiName(event.midi)}</span>`).join("");elements.followProgress.textContent=`${follow.index}/${follow.song.events.length} · ${FOLLOW_RATE_LABEL}`;}
  function finishFollow(){const summary=model.summarizeScore(follow.attempts);document.getElementById("result-rating").textContent=summary.rating;document.getElementById("result-score").textContent=summary.total;document.getElementById("result-notes").textContent=`${Math.round(summary.noteAccuracy*100)}%`;document.getElementById("result-rhythm").textContent=`${Math.round(summary.rhythmAccuracy*100)}%`;document.getElementById("result-streak").textContent=summary.longestStreak;progress.bestScores[follow.song.id]=Math.max(progress.bestScores[follow.song.id]||0,summary.total);progress.recentSongId=follow.song.id;saveJson(keys.progress,progress);followStage.target=null;leaveFollowLandscape();openView("result");}
  function exitFollow(){if(follow){setMode(follow.originalMode);follow=null;}followStage.target=null;leaveFollowLandscape();openView("library");}
  function toggleFollowPause(){if(!follow)return;if(follow.paused){const pausedFor=performance.now()-follow.pauseAt;follow.startedAt+=pausedFor;follow.paused=false;document.getElementById("pause-follow").textContent="暂停";elements.judgement.textContent="继续跟奏";requestRender();}else{follow.paused=true;follow.pauseAt=performance.now();document.getElementById("pause-follow").textContent="继续";elements.judgement.textContent="已暂停";}}

  function toggleRecording(){if(!recording){recording=model.createRecording(settings.tuningMode,performance.now());recordingClock=performance.now();elements.recordButton.classList.add("is-recording");elements.recordButton.innerHTML="<span aria-hidden=\"true\">●</span> 录制中 00:00";recordingTimer=window.setInterval(()=>updateRecordingClock(performance.now()),250);toast("第一声将记为 00:00");}else{window.clearInterval(recordingTimer);recordingTimer=0;const finished=model.finishRecording(recording,performance.now());recording=finished;elements.recordButton.classList.remove("is-recording");elements.recordButton.innerHTML="<span aria-hidden=\"true\">●</span> 录钟曲";openRecordSheet(finished);}}
  function updateRecordingClock(now){if(!recording||recording.durationMs!==undefined)return;const elapsed=recording.firstStrikeAt===null?0:now-recording.firstStrikeAt;elements.recordButton.innerHTML=`<span aria-hidden="true">●</span> 录制中 ${formatTime(elapsed)}`;if(elapsed>=300000)toggleRecording();}
  function openRecordSheet(result){document.getElementById("record-duration").textContent=formatTime(result.durationMs);document.getElementById("record-count").textContent=`${result.events.length} 次敲击`;document.getElementById("work-title").value=`我的钟曲 ${String(works.length+1).padStart(2,"0")}`;document.getElementById("work-error").textContent="";elements.recordSheet.hidden=false;}
  function closeRecordSheet(){elements.recordSheet.hidden=true;}
  function saveWork(){const title=document.getElementById("work-title").value.trim();const error=document.getElementById("work-error");if(!title){error.textContent="请输入名称后再保存";return;}if(!recording||!recording.events.length){error.textContent="还没有记录到敲击，请先奏几声";return;}if(!model.canStoreWork(works)){error.textContent="钟曲已存得有些多了，请先整理旧作品";return;}const work={id:`work-${Date.now()}`,version:1,title,createdAt:Date.now(),durationMs:recording.durationMs,tuningMode:recording.tuningMode,events:recording.events};const next=[work].concat(works);if(saveJson(keys.works,next)){works=next;recording=null;closeRecordSheet();renderWorks();toast(`已收入「${title}」`);}}
  function playPerformance(work){if(!work||!Array.isArray(work.events)||!work.events.length){toast("这首钟曲没有可回放的敲击");return;}openView("play");stopPlaybackTimers();audio.unlock();work.events.forEach((event)=>playbackTimers.push(setTimeout(()=>{const layout=mainStage.layouts.find((item)=>item.bell.id===event.bellId);if(layout)strike({layout,zone:event.zone,x:layout.x+layout.width*(event.zone==="center"?.5:.18),y:layout.y+layout.height*.58},mainStage,"system",event.resolvedMidi);},event.tMs)));toast(`回放「${work.title}」`);}
  function renderWorks(){elements.worksCount.textContent=String(works.length).padStart(2,"0");if(!works.length){elements.worksList.innerHTML='<article class="empty-card works-empty"><span aria-hidden="true">◇</span><h3>还没有钟曲</h3><div class="card-meta">回到「奏钟」录下第一段演奏，作品会保存在当前设备。</div></article>';return;}elements.worksList.innerHTML=works.map((work)=>`<article class="work-row"><button class="work-play" type="button" data-play-work="${work.id}" aria-label="回放${escapeHtml(work.title)}">▶</button><span class="work-copy"><strong>${escapeHtml(work.title)}</strong><small>${formatTime(work.durationMs)} · ${work.events.length} 次敲击 · ${new Date(work.createdAt).toLocaleDateString("zh-CN")}</small></span><button class="work-delete" type="button" data-delete-work="${work.id}">删除</button></article>`).join("");}
  function escapeHtml(value){return String(value).replace(/[&<>"']/g,(character)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));}
  function deleteWork(button,id){if(button.dataset.confirm!=="true"){button.dataset.confirm="true";button.textContent="再次点击删除";toast("再次点击会删除这首本地钟曲");setTimeout(()=>{button.dataset.confirm="false";button.textContent="删除";},3000);return;}const next=works.filter((work)=>work.id!==id);if(saveJson(keys.works,next)){works=next;renderWorks();toast("已删除这首钟曲");}}

  function applySettings(){audio.setVolume(settings.volume);elements.modeButton.textContent=settings.tuningMode==="pentatonic"?"五声易奏":"全律演奏";elements.labelsButton.textContent=`音名 ${settings.showLabels?"开":"关"}`;document.body.classList.toggle("reduce-motion",settings.reduceMotion);document.getElementById("volume-range").value=Math.round(settings.volume*100);document.getElementById("show-labels-toggle").checked=settings.showLabels;document.getElementById("reduce-motion-toggle").checked=settings.reduceMotion;}
  function openSettings(){elements.settingsSheet.hidden=false;}
  function closeSettings(){elements.settingsSheet.hidden=true;}
  function handleVisibility(){if(document.hidden){audio.stopAll();stopListening();if(follow&&!follow.paused)toggleFollowPause();activePointers.clear();window.cancelAnimationFrame(animationFrame);animationFrame=0;}else requestRender();}

  elements.unlock.addEventListener("click",unlockAudio);elements.bootBell.addEventListener("pointerdown",previewBootBell);window.addEventListener("resize",scheduleResize);document.addEventListener("visibilitychange",handleVisibility);
  elements.modeButton.addEventListener("click",()=>{const open=elements.modeMenu.hidden;elements.modeMenu.hidden=!open;elements.modeButton.setAttribute("aria-expanded",String(open));});
  elements.modeMenu.addEventListener("click",(event)=>{const button=event.target.closest("[data-mode]");if(button)setMode(button.dataset.mode);});
  elements.labelsButton.addEventListener("click",()=>{settings.showLabels=!settings.showLabels;applySettings();persistSettings();});elements.recordButton.addEventListener("click",toggleRecording);
  document.addEventListener("click",(event)=>{const open=event.target.closest("[data-open-view]");if(open)openView(open.dataset.openView);const back=event.target.closest("[data-back]");if(back)openView(previousView||"play");});
  document.getElementById("category-filter").addEventListener("click",(event)=>{const button=event.target.closest("[data-category]");if(!button)return;document.querySelectorAll("[data-category]").forEach((item)=>item.classList.toggle("is-active",item===button));renderSongs(button.dataset.category);});
  elements.songList.addEventListener("click",(event)=>{const button=event.target.closest("[data-song-id]");if(button)openSongSheet(songs.find((song)=>song.id===button.dataset.songId));});
  document.querySelector("[data-close-sheet]").addEventListener("click",closeSongSheet);document.getElementById("listen-song").addEventListener("click",()=>startListening(selectedSong));document.getElementById("follow-song").addEventListener("click",()=>startFollow(selectedSong));
  document.getElementById("exit-follow").addEventListener("click",exitFollow);document.getElementById("pause-follow").addEventListener("click",toggleFollowPause);document.getElementById("retry-song").addEventListener("click",()=>startFollow(selectedSong));
  document.querySelector("[data-close-record]").addEventListener("click",closeRecordSheet);document.getElementById("save-work").addEventListener("click",saveWork);document.getElementById("preview-recording").addEventListener("click",()=>recording&&playPerformance({title:"刚才的钟曲",...recording}));document.getElementById("discard-recording").addEventListener("click",()=>{recording=null;closeRecordSheet();toggleRecording();});
  elements.worksList.addEventListener("click",(event)=>{const play=event.target.closest("[data-play-work]");if(play)playPerformance(works.find((work)=>work.id===play.dataset.playWork));const remove=event.target.closest("[data-delete-work]");if(remove)deleteWork(remove,remove.dataset.deleteWork);});
  elements.knowledgeBell.addEventListener("pointerdown",previewKnowledgeBell);document.querySelectorAll("[data-demo-midi]").forEach((button)=>button.addEventListener("click",()=>{const midi=Number(button.dataset.demoMidi);audio.unlock();audio.play(midi,.78);elements.cultureHit.lastChild.textContent=`已敲 · ${button.dataset.demoZone} ${model.midiName(midi)}`;elements.cultureHit.classList.remove("is-ringing");void elements.cultureHit.offsetWidth;elements.cultureHit.classList.add("is-ringing");}));
  document.getElementById("open-settings").addEventListener("click",openSettings);document.querySelector("[data-close-settings]").addEventListener("click",closeSettings);document.getElementById("volume-range").addEventListener("input",(event)=>{settings.volume=Number(event.target.value)/100;audio.setVolume(settings.volume);persistSettings();});document.getElementById("show-labels-toggle").addEventListener("change",(event)=>{settings.showLabels=event.target.checked;applySettings();persistSettings();});document.getElementById("reduce-motion-toggle").addEventListener("change",(event)=>{settings.reduceMotion=event.target.checked;applySettings();persistSettings();});document.getElementById("replay-tutorial").addEventListener("click",()=>{progress.tutorialDone=false;saveJson(keys.progress,progress);closeSettings();openView("play");elements.guide.hidden=false;});

  if(window.visualViewport)window.visualViewport.addEventListener("resize",scheduleResize);
  window.addEventListener("orientationchange",()=>window.setTimeout(setAppHeight,120));
  document.addEventListener("gesturestart",(event)=>event.preventDefault(),{passive:false});
  document.getElementById("wide-note-close").addEventListener("click",()=>{document.getElementById("wide-note").hidden=true;});

  setAppHeight();applySettings();renderSongs("全部");renderWorks();
})();
