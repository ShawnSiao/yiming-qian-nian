import {t,tr,getLocale} from './i18n.mjs';
import { BellAudio } from './audio.mjs';
import { noteName } from './session.mjs';
import { validateTargets } from './model.mjs';
import { performanceLayout, performanceLayoutChanged, findPerformanceHit, performanceContact, bellNoteTags, resolveTargetPointer } from './performance-layout.mjs';
import {STRIKE_FEEDBACK_MS,malletFeedback} from './strike-feedback.mjs';
import {registerLabel,registerMark} from './paired-instrument.mjs';
import {loadBellImage} from './image-resource.mjs';
import {drawBellPlaceholder} from './bell-placeholder.mjs';
import {displayPitch} from './pitch-display.mjs';

const IMAGE_KEYS=['top','middle','bottom','mallet'];
const GOLD='#c6aa68',RICE='#eee2c7';

// Adapted from main@20b716d assets/app.js drawNoteBadge, not a DOM button.
// Preserve its clipped copper edges, inset rim, small eyelet and patinated
// fill. Open letterforms keep c/e distinct while the plaque shape stays intact.
export function drawNotePlaque(ctx,tag,highlighted=false){
  const {x:left,y:top,width,height,fontSize,text,region}=tag;
  if(tag.variant==='pair'){
    const gx=tag.groupX,gw=tag.groupWidth,cut=3;
    ctx.save();ctx.beginPath();ctx.moveTo(gx+cut,top);ctx.lineTo(gx+gw-cut,top);ctx.lineTo(gx+gw,top+cut);ctx.lineTo(gx+gw,top+height-cut);ctx.lineTo(gx+gw-cut,top+height);ctx.lineTo(gx+cut,top+height);ctx.lineTo(gx,top+height-cut);ctx.lineTo(gx,top+cut);ctx.closePath();
    if(region==='center'){ctx.fillStyle='#142018';ctx.fill();ctx.strokeStyle='rgba(197,164,93,.78)';ctx.lineWidth=1;ctx.stroke();ctx.strokeStyle='rgba(197,164,93,.3)';ctx.beginPath();ctx.moveTo(gx+gw/2,top+5);ctx.lineTo(gx+gw/2,top+height-5);ctx.stroke();}
    if(highlighted){ctx.clip();ctx.fillStyle='#c5a45d';ctx.fillRect(left-1,top+1,width+2,height-2);}
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=highlighted?'#172018':'#fff1ce';
    if(width>=52){ctx.font='10px sans-serif';ctx.fillText(tag.caption,left+11,top+height/2);ctx.font=`700 ${fontSize}px Georgia,serif`;ctx.fillText(text,left+width/2+5,top+height/2+.5);}
    else{ctx.font='9px sans-serif';ctx.fillText(tag.caption,left+width/2,top+7.5);ctx.font=`700 ${fontSize}px Georgia,serif`;ctx.fillText(text,left+width/2,top+21.5);}
    ctx.restore();return;
  }
  if(tag.variant){
    ctx.save();const cut=3;ctx.beginPath();ctx.moveTo(left+cut,top);ctx.lineTo(left+width-cut,top);ctx.lineTo(left+width,top+cut);ctx.lineTo(left+width,top+height-cut);ctx.lineTo(left+width-cut,top+height);ctx.lineTo(left+cut,top+height);ctx.lineTo(left,top+height-cut);ctx.lineTo(left,top+cut);ctx.closePath();
    ctx.shadowColor='rgba(0,0,0,.62)';ctx.shadowBlur=3;ctx.fillStyle=highlighted?'#c5a45d':'#142018';ctx.fill();ctx.shadowBlur=0;
    ctx.strokeStyle=highlighted?'#fff2cd':'#bfa260';ctx.lineWidth=1.1;ctx.stroke();ctx.strokeStyle='rgba(197,164,93,.25)';ctx.lineWidth=.5;ctx.strokeRect(left+2.5,top+2.5,width-5,height-5);
    ctx.fillStyle=highlighted?'#172018':'#fff1ce';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font=`700 ${fontSize}px Georgia,serif`;ctx.fillText(text,left+width/2,top+height/2+.5);
    ctx.restore();return;
  }
  const x=left+width/2,y=top+height/2,isCenter=region==='center',cut=isCenter?3.2:height*.34;
  ctx.save();ctx.font=`600 ${fontSize}px Arial,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.strokeStyle=highlighted?'rgba(224,199,125,.82)':'rgba(117,100,59,.65)';ctx.lineWidth=.7;
  if(!isCenter&&Number.isFinite(tag.anchorX)){ctx.beginPath();ctx.moveTo(tag.anchorX,tag.anchorY-2);ctx.lineTo(x,top-2);ctx.stroke();ctx.beginPath();ctx.arc(tag.anchorX,tag.anchorY-2,1.5,0,Math.PI*2);ctx.stroke();}
  ctx.beginPath();ctx.moveTo(x-2.5,top);ctx.lineTo(x-2.5,top-(isCenter?3:2));ctx.lineTo(x+2.5,top-(isCenter?3:2));ctx.lineTo(x+2.5,top);ctx.stroke();
  const trace=inset=>{
    const l=left+inset,t=top+inset,w=width-inset*2,h=height-inset*2,c=Math.max(1,cut-inset*.45);
    ctx.beginPath();ctx.moveTo(l+c,t);ctx.lineTo(l+w-c,t);ctx.lineTo(l+w,t+c);ctx.lineTo(l+w,t+h-c);ctx.lineTo(l+w-c,t+h);ctx.lineTo(l+c,t+h);ctx.lineTo(l,t+h-c);ctx.lineTo(l,t+c);ctx.closePath();
  };
  const metal=ctx.createLinearGradient(left,top,left+width,top+height);
  if(highlighted){metal.addColorStop(0,'#765523');metal.addColorStop(.46,'#d0ad60');metal.addColorStop(1,'#624419');ctx.shadowColor='rgba(210,177,94,.66)';ctx.shadowBlur=6;}
  else{metal.addColorStop(0,'#29342d');metal.addColorStop(.52,'#202b25');metal.addColorStop(1,'#111815');ctx.shadowColor='rgba(0,0,0,.64)';ctx.shadowBlur=2;}
  trace(0);ctx.fillStyle=metal;ctx.fill();ctx.strokeStyle=highlighted?'rgba(230,205,134,.86)':'rgba(117,100,59,.78)';ctx.lineWidth=.8;ctx.stroke();ctx.shadowBlur=0;
  trace(2);ctx.strokeStyle=highlighted?'rgba(72,49,19,.62)':'rgba(178,151,82,.28)';ctx.lineWidth=.55;ctx.stroke();
  ctx.fillStyle=highlighted?'#24180b':'#ded0a6';ctx.globalAlpha=1;
  const octave=tag.octave||0,digitY=y+.25+(octave>0?2:octave<0?-2:0);
  ctx.fillText(text,x,digitY);
  if(octave){
    const dotX=x+(text.startsWith('♯')?ctx.measureText('♯').width/2:0),dotY=digitY+(octave>0?-fontSize*.60-2:fontSize*.55+1.2),count=Math.abs(octave);
    for(let i=0;i<count;i++){ctx.beginPath();ctx.arc(dotX+(i-(count-1)/2)*3.4,dotY,1.15,0,Math.PI*2);ctx.fill();}
  }
  ctx.restore();
}

export class PerformanceScene {
  constructor(host,{audio,onMeasure=()=>{},onStrike=()=>{},onMessage=()=>{},onInterrupt=()=>{}}={}) {
    this.host=host;this.audio=audio||new BellAudio();this.ownsAudio=!audio;
    Object.assign(this,{onMeasure,onStrike,onMessage,onInterrupt});
    this.options={active:true,choice:'auto',startOctave:4,labels:true,muted:false,diagnostics:false,noteStyle:'classic',locale:getLocale(),notation:'pitch',notationKey:'C'};
    this.history=[];this.effects=[];this.pointers=new Map();this.frames=0;this.raf=0;this.lastFrame=0;this.disposed=false;
    this.images={};this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.surface=document.createElement('div');this.surface.className='scene-surface main-performance-surface';
    this.surface.dataset.mode='play';this.surface.dataset.renderer='main-canvas';
    this.rackCanvas=document.createElement('canvas');this.rackCanvas.className='main-rack';this.rackCanvas.setAttribute('aria-hidden','true');
    this.canvas=document.createElement('canvas');this.canvas.className='main-bells';this.canvas.dataset.engine='main-canvas-2d';
    this.canvas.setAttribute('aria-label',t('编钟钟面，中央正鼓、左右侧鼓'));this.canvas.tabIndex=0;
    this.overlay=document.createElement('div');this.overlay.className='scene-overlay';
    this.surface.append(this.rackCanvas,this.canvas,this.overlay);host.append(this.surface);
    this.ctx=this.canvas.getContext('2d');this.rack=this.rackCanvas.getContext('2d');
    this.pixelRatio=Math.min(devicePixelRatio||1,Math.min(innerWidth,innerHeight)<600?1.5:2);
    this.handleDown=event=>{
      if(!this.canPlay()||event.button!==0||this.pointers.has(event.pointerId))return;
      const rect=this.canvas.getBoundingClientRect(),hit=findPerformanceHit(this.layout,event.clientX-rect.left,event.clientY-rect.top,{surfaceOnly:true,labels:this.options.labels});
      if(!hit)return;
      event.preventDefault();this.capture(event,this.canvas);this.strike(hit.bell,hit.region,'bell-surface');
    };
    this.handleRelease=event=>this.release(event.pointerId);
    this.canvas.addEventListener('pointerdown',this.handleDown);
    for(const type of ['pointerup','pointercancel','lostpointercapture'])this.surface.addEventListener(type,this.handleRelease);
    this.handleKey=event=>{
      if(!this.canPlay()||event.repeat||event.ctrlKey||event.altKey||event.metaKey||document.querySelector('dialog[open]')||/INPUT|SELECT|TEXTAREA/.test(event.target.tagName))return;
      const keys=['1234','qwer','asdf'],row=keys.findIndex(k=>k.includes(event.key.toLowerCase()));
      if(row<0||row>=this.layout.rows)return;
      const column=keys[row].indexOf(event.key.toLowerCase()),bell=this.layout.bells.find(b=>b.row===row&&b.column===column);
      if(bell){event.preventDefault();this.strike(bell,event.shiftKey?'right':'center','keyboard');}
    };
    this.handleBlur=()=>{this.cancelInput(true);this.onInterrupt('blur');};
    this.handleHidden=()=>{if(document.hidden){this.cancelInput(true);this.onInterrupt('hidden');}else this.invalidate();};
    window.addEventListener('keydown',this.handleKey);window.addEventListener('blur',this.handleBlur);document.addEventListener('visibilitychange',this.handleHidden);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.resize();
    this.imageFailures=new Set();this.retry=document.createElement('button');this.retry.className='asset-retry';this.retry.type='button';this.retry.textContent=t('重试图片');this.retry.hidden=true;
    this.retry.onclick=()=>this.loadImages([...this.imageFailures]);this.surface.append(this.retry);
    this.assetsReady=this.loadImages(IMAGE_KEYS);
    // The local placeholder is already playable; a slow image cannot block music.
    this.ready=Promise.resolve(this);
  }
  loadImages(keys){
    this.retry.disabled=true;
    return Promise.allSettled(keys.map(async key=>{
      try{
        const {image:img,url}=await loadBellImage(key);if(this.disposed)return;
        const cached=document.createElement('canvas');cached.width=img.naturalWidth;cached.height=img.naturalHeight;
        const ctx=cached.getContext('2d');ctx.filter=key==='mallet'?'brightness(1.12)':'brightness(1.28) contrast(1.04)';ctx.drawImage(img,0,0);this.images[key]=cached;this.imageFailures.delete(key);
        this.surface.dataset[key+'Source']=url.split('/').pop();this.invalidate();
      }catch{if(!this.disposed)this.imageFailures.add(key);}
    })).then(()=>{if(!this.disposed){this.retry.disabled=false;this.retry.hidden=!this.imageFailures.size;this.surface.dataset.assetErrors=String(this.imageFailures.size);this.invalidate();}});
  }
  canPlay(){return this.options.active&&!document.hidden&&!this.disposed&&!!this.layout;}
  capture(event,element){try{element.setPointerCapture(event.pointerId);}catch{}this.pointers.set(event.pointerId,element);this.publish();}
  release(id){const el=this.pointers.get(id);this.pointers.delete(id);if(el?.hasPointerCapture(id))el.releasePointerCapture(id);this.publish();}
  cancelInput(silence=false){for(const id of [...this.pointers.keys()])this.release(id);if(silence)this.audio.stop();this.effects=[];cancelAnimationFrame(this.raf);this.raf=0;this.invalidate();}
  setOptions(next){
    const before=this.options;this.options={...before,...next};
    if(before.locale!==this.options.locale)this.canvas.setAttribute('aria-label',t('编钟钟面，中央正鼓、左右侧鼓'));
    if(this.retry)this.retry.textContent=t('重试图片');
    this.audio.setMuted(this.options.muted);
    this.surface.hidden=!this.options.active;
    if(before.active!==this.options.active)this.cancelInput(true);
    this.surface.classList.toggle('show-diagnostics',this.options.diagnostics);
    this.surface.classList.toggle('hide-labels',!this.options.labels);
    if(['choice','startOctave','noteStyle','locale'].some(k=>before[k]!==this.options[k])){this.cancelInput(true);this.resize(true);}
    else{
      if(this.layout&&(before.notation!==this.options.notation||before.notationKey!==this.options.notationKey)){
        this.layout.notation=this.options.notation;this.layout.notationKey=this.options.notationKey;
        this.refreshNoteLabels();this.publish(true);
      }
      this.invalidate();
    }
  }
  resize(force=false){
    if(this.disposed)return;const rect=this.host.getBoundingClientRect();if(rect.width<1||rect.height<1)return;
    const width=Math.floor(rect.width),height=Math.floor(rect.height),portrait=matchMedia('(orientation: portrait)').matches,key=`${width}:${height}:${portrait}:${this.options.choice}:${this.options.startOctave}:${this.options.noteStyle}:${this.options.locale}`;
    if(!force&&key===this.layoutKey)return;
    const mobile=matchMedia('(pointer: coarse)').matches||Math.min(innerWidth,innerHeight)<600||width<900;
    const next=performanceLayout(width,height,{...this.options,mobile,portrait}),changed=performanceLayoutChanged(this.layout,next);
    if(this.layoutKey&&!force&&this.options.active&&changed)this.onInterrupt('resize');
    this.layoutKey=key;this.cancelInput(force||changed);this.layout=next;
    this.surface.style.width=`${width}px`;this.surface.style.height=`${height}px`;
    for(const [canvas,ctx] of [[this.canvas,this.ctx],[this.rackCanvas,this.rack]]){
      canvas.width=Math.round(width*this.pixelRatio);canvas.height=Math.round(height*this.pixelRatio);canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;ctx.setTransform(this.pixelRatio,0,0,this.pixelRatio,0,0);
    }
    this.targets=this.layout.bells.flatMap(b=>b.targets);
    this.bodies=this.layout.bells.map(b=>({id:b.data.id,x:b.x,y:b.y+b.height*.26,width:b.width,height:b.height*.7}));
    this.issues=validateTargets(this.targets,this.bodies,width,height,this.layout);
    this.buildOverlay();this.drawRack();this.publish(true);this.onMeasure(this.snapshot());this.invalidate();
  }
  buildOverlay(){
    this.overlay.replaceChildren();this.buttons=new Map();
    for(const [frameIndex,frame] of this.layout.frames.entries()){
      const bell=this.layout.bells.find(b=>b.frame===frameIndex),label=document.createElement('div');
      label.className='register-label';label.style.top=`${frame.top+frame.height/2}px`;label.setAttribute('aria-label',registerLabel(bell.data.octave));label.innerHTML=tr`<span>${registerMark(bell.data.octave)}</span><small>音组</small>`;this.overlay.append(label);
    }
    for(const bell of this.layout.bells)for(const target of bell.targets){
      const button=document.createElement('button');button.className='strike-target';button.type='button';
      button.dataset.bell=bell.data.id;button.dataset.region=target.region;button.dataset.midi=String(bell.data[target.region==='center'?'centerMidi':'sideMidi']);
      button.dataset.bellStyle=bell.imageKey;
      button.style.left=`${target.x}px`;button.style.top=`${target.y}px`;
      button.addEventListener('pointerdown',e=>{
        if(!this.canPlay()||e.button!==0||this.pointers.has(e.pointerId))return;
        e.preventDefault();this.capture(e,button);
        const bounds=this.canvas.getBoundingClientRect();
        const hit=resolveTargetPointer(this.layout,bell,target.region,e.clientX-bounds.left,e.clientY-bounds.top,this.options.labels);
        this.strike(hit.bell,hit.region,'pointer');
      });
      button.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();if(!e.repeat&&this.canPlay())this.strike(bell,target.region,'keyboard');}});
      button.addEventListener('click',e=>{if(e.detail===0&&this.canPlay())this.strike(bell,target.region,'accessibility');});
      const measure=document.createElement('span');measure.className='target-measure';measure.textContent='44';button.append(measure);
      this.buttons.set(target.key,button);this.overlay.append(button);
    }
    this.refreshNoteLabels();
  }
  refreshNoteLabels(){
    const name=midi=>displayPitch(midi,this.options.notation,this.options.notationKey).description;
    for(const bell of this.layout.bells)for(const target of bell.targets){
      this.buttons.get(target.key)?.setAttribute('aria-label',tr`${name(bell.data.centerMidi)} 编钟，${target.region==='center'?t('正鼓 ')+name(bell.data.centerMidi):t('右侧鼓 ')+name(bell.data.sideMidi)}`);
    }
  }
  // Adapted from main@20b716d assets/app.js drawRack, preserving its red
  // lacquer, thin old-gold edges, rings and stable front-facing composition.
  drawRack(){
    const ctx=this.rack,{width,height,frames,bells}=this.layout;ctx.clearRect(0,0,width,height);
    const wood=ctx.createLinearGradient(0,0,width,0);wood.addColorStop(0,'#30100e');wood.addColorStop(.28,'#582019');wood.addColorStop(.5,'#722b22');wood.addColorStop(.72,'#4c1915');wood.addColorStop(1,'#30100e');
    ctx.fillStyle=wood;ctx.strokeStyle='rgba(198,170,104,.65)';ctx.lineWidth=.9;
    for(const x of [9,width-21]){ctx.beginPath();ctx.roundRect(x,3,12,height-11,4);ctx.fill();ctx.stroke();ctx.fillStyle='rgba(198,170,104,.23)';ctx.fillRect(x+3,7,1,height-20);ctx.fillStyle=wood;}
    for(const [index,frame] of frames.entries()){
      const y=frame.top+4;ctx.beginPath();ctx.roundRect(14,y,width-28,8,2);ctx.fill();ctx.stroke();
      ctx.strokeStyle='rgba(238,226,199,.24)';ctx.beginPath();ctx.moveTo(23,y+2);ctx.lineTo(width-23,y+2);ctx.stroke();ctx.strokeStyle='rgba(198,170,104,.65)';
      for(const bell of bells.filter(b=>b.frame===index)){ctx.fillStyle='#202b25';ctx.beginPath();ctx.ellipse(bell.cx,y+8,3,4,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=wood;}
    }
    for(const x of [15,width-15]){ctx.beginPath();ctx.moveTo(x-7,height-12);ctx.lineTo(x+7,height-12);ctx.lineTo(x+11,height-3);ctx.lineTo(x-11,height-3);ctx.closePath();ctx.fill();ctx.stroke();}
  }
  strike(bell,region,source='pointer',velocity=.85){
    if(!this.canPlay())return;
    const midi=region==='center'?bell.data.centerMidi:bell.data.sideMidi,at=performance.now();
    const event={midi,region,zone:region==='center'?'center':'side',source,at,name:noteName(midi),bellId:bell.data.id};
    this.audio.strike(midi,0,velocity).catch(()=>this.onMessage(t('声音暂不可用，请再次轻触钟面。')));
    this.history.push(event);if(this.history.length>128)this.history.shift();
    this.effects.push({bell,region,point:bell.points[region],at,source});this.effects=this.effects.slice(-8);
    this.publish();this.onStrike(event);this.invalidate();
  }
  strikeMidi(midi,source='playback',velocity=.85,preferred,bellId){
    const contact=performanceContact(this.layout,midi,preferred,bellId);
    if(contact)this.strike(contact.bell,contact.region,source,velocity);
    else this.audio.strike(midi,0,velocity).catch(()=>{});
  }
  setTarget(midi){this.target=midi;this.invalidate();}
  setCue(remaining){this.cue=remaining;this.invalidate();}
  draw(now){
    const ctx=this.ctx,{width,height}=this.layout;ctx.clearRect(0,0,width,height);
    this.effects=this.effects.filter(e=>now-e.at<(this.reduced?240:STRIKE_FEEDBACK_MS));
    for(const bell of this.layout.bells){
      const effect=[...this.effects].reverse().find(e=>e.bell===bell),age=effect?now-effect.at:10000;
      const energy=Math.exp(-age/180),swing=this.reduced?0:Math.sin(age/44)*energy*.012;
      const image=this.images[bell.imageKey];
      ctx.save();ctx.translate(bell.cx,bell.y);ctx.rotate(swing);ctx.translate(-bell.cx,-bell.y);
      if(this.options.focusTarget&&this.target!=null&&bell.data.centerMidi!==this.target&&bell.data.sideMidi!==this.target&&!effect)ctx.globalAlpha=.82;
      if(image){const s=Math.min(bell.width/image.width,bell.height/image.height);ctx.drawImage(image,bell.cx-image.width*s/2,bell.y,image.width*s,image.height*s);}
      else drawBellPlaceholder(ctx,bell);
      if(this.options.labels)for(const tag of bellNoteTags(this.layout,bell)){
        const highlighted=!!effect&&age<330&&(tag.region==='center'?effect.region==='center':effect.region!=='center');
        drawNotePlaque(ctx,tag,highlighted);
      }
      ctx.restore();
    }
    const target=performanceContact(this.layout,this.target);
    if(target){const {x,y}=target.point,radius=18,progress=Math.max(0,Math.min(1,1-(this.cue??350)/350));ctx.strokeStyle=GOLD;ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.stroke();ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,radius+3,-Math.PI/2,-Math.PI/2+progress*Math.PI*2);ctx.stroke();}
    this.effects.forEach((effect,index)=>this.drawEffect(ctx,effect,now,index>=this.effects.length-3));
  }
  drawEffect(ctx,effect,now,showMallet=true){
    const elapsed=now-effect.at,feedback=malletFeedback(effect.bell,elapsed,this.layout.mobile);
    const age=elapsed/STRIKE_FEEDBACK_MS,fade=feedback.ringAlpha,{x,y}=effect.point;ctx.save();ctx.globalAlpha=fade;
    ctx.fillStyle='rgba(238,226,199,.24)';ctx.beginPath();ctx.arc(x,y,this.reduced?8:7+age*6,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=GOLD;ctx.lineWidth=2.2;ctx.beginPath();ctx.arc(x,y,this.reduced?14:10+age*27,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle=RICE;ctx.lineWidth=1.4;ctx.beginPath();for(let p=-28;p<=28;p+=2){const yy=y+Math.sin(p*.35-age*8)*6*(1-Math.abs(p)/32)*fade;p===-28?ctx.moveTo(x+p,yy):ctx.lineTo(x+p,yy);}ctx.stroke();
    const mallet=this.images.mallet;
    if(!this.reduced&&showMallet&&feedback.alpha>0){
      const side=effect.region==='left'?-1:1,{height:h,recoil,alpha}=feedback,w=143/640*h;
      ctx.globalAlpha=alpha;ctx.translate(x+side*recoil*16,y+recoil*18);ctx.rotate(side*recoil*.13);
      if(mallet)ctx.drawImage(mallet,-w/2,-h*.14,w,h);else{ctx.fillStyle=GOLD;ctx.fillRect(-w/2,-h*.05,w,h*.1);ctx.fillRect(-3,0,6,h*.7);}
    }
    ctx.restore();
  }
  publish(layoutChanged=false){
    if(!this.surface)return;
    Object.assign(this.surface.dataset,{eventCount:String(this.history.length),audioNotesStarted:String(this.audio.count),audioState:this.audio.context?.state||'not-started',activePointers:String(this.pointers.size),lastMidi:String(this.history.at(-1)?.midi||''),lastRegion:this.history.at(-1)?.region||'',plaqueStyle:`r27-${this.options.noteStyle}:${this.options.locale}`,labelsVisible:String(this.options.labels),notation:this.options.notation,notationKey:this.options.notationKey});
    const impact=this.effects.at(-1);if(impact)Object.assign(this.surface.dataset,{malletHeight:String(malletFeedback(impact.bell,0,this.layout.mobile).height),impactX:String(impact.point.x),impactY:String(impact.point.y),feedbackDuration:String(STRIKE_FEEDBACK_MS)});
    if(layoutChanged&&this.layout){this.surface.dataset.layout=JSON.stringify({...this.layout,bells:undefined,issues:this.issues||[]});this.surface.dataset.targets=JSON.stringify(this.targets);this.surface.dataset.bodies=JSON.stringify(this.bodies);this.surface.dataset.contacts=JSON.stringify(this.layout.bells.map(b=>({id:b.data.id,...b.points})));this.surface.dataset.notePlaques=JSON.stringify(this.layout.bells.flatMap(b=>bellNoteTags(this.layout,b).map(t=>({...t,midi:t.region==='center'?b.data.centerMidi:b.data.sideMidi}))));}
  }
  invalidate(){this.dirty=true;if(!this.raf&&this.options.active&&!document.hidden&&!this.disposed)this.raf=requestAnimationFrame(t=>this.render(t));}
  render(now){this.raf=0;if(!this.canPlay())return;if(this.dirty||now-this.lastFrame>=32){this.dirty=false;this.lastFrame=now;this.frames++;this.draw(now);this.canvas.dataset.frameCount=String(this.frames);this.publish();}if(this.effects.length)this.raf=requestAnimationFrame(t=>this.render(t));}
  snapshot(){return {ready:!!this.layout,mode:'play',renderer:'main-canvas',layout:this.layout&&{...this.layout,bells:undefined},targets:this.targets||[],bodies:this.bodies||[],issues:this.issues||[],frameCount:this.frames,rafPending:!!this.raf,activePointers:this.pointers.size,audioNotesStarted:this.audio.count,audioState:this.audio.context?.state||'not-started',events:[...this.history],bellCount:this.layout?.bells.length||0,visiblePitches:this.layout?.bells.map(b=>b.data)||[],rackVisible:true,triangles:0};}
  dispose(){this.disposed=true;this.cancelInput(true);this.observer.disconnect();window.removeEventListener('keydown',this.handleKey);window.removeEventListener('blur',this.handleBlur);document.removeEventListener('visibilitychange',this.handleHidden);this.surface.remove();if(this.ownsAudio)this.audio.dispose();}
}
