import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {chromium,firefox,webkit} from 'playwright';

const output=resolve(process.env.YIMING_QA_DIR||'output/browser-compat');await mkdir(output,{recursive:true});
const base=process.env.YIMING_BASE_URL||'http://127.0.0.1:4320/app/';
let server;if(!process.env.YIMING_BASE_URL){
  server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:'4320'},stdio:['ignore','pipe','pipe']});
  await new Promise((done,reject)=>{server.stdout.once('data',done);server.once('error',reject);server.once('exit',code=>reject(new Error(`Preview exited ${code}`)));});
}
const report={date:new Date().toISOString(),base,results:[],engines:[],limits:['No physical iPhone, Android phone or the originally failing remote Edge computer is controlled by this test.']};
const selectedCases=process.env.YIMING_CASES?.split(',');if(selectedCases)report.selectedCases=selectedCases;
const heavy=url=>/\/(?:models\/.*\.glb|vendor\/(?:three|OrbitControls|GLTFLoader)|home-bell-scene\.mjs|geometry\.mjs|lighting\.mjs|section-cap\.mjs)/.test(url);
const modelSwitch=page=>page.getByRole('switch',{name:/3D/});
const nav=(page,index)=>page.locator('.app-header nav button').nth(index).click();
async function open(page,view='home',lang='zh'){await page.goto(`${base}?lang=${lang}#${view}`);await page.locator('.bell-app').waitFor();}
async function hit(page,id,region,midi){
  const surface=page.locator('.main-performance-surface');
  const contacts=JSON.parse(await surface.getAttribute('data-contacts')),contact=contacts.find(c=>c.id===id)?.[region];assert.ok(contact,`${id}:${region} exists`);
  const bounds=await page.locator('.main-bells').boundingBox();await page.mouse.click(bounds.x+contact.x,bounds.y+contact.y);
  await page.waitForFunction(expected=>document.querySelector('.main-performance-surface')?.dataset.lastMidi===String(expected),midi);
}
async function homeHit(page,region='center'){
  const host=page.locator('.home-2d-host'),contacts=JSON.parse(await host.getAttribute('data-contacts')),point=contacts.find(c=>c.region===region),bounds=await host.boundingBox();
  await page.mouse.click(bounds.x+point.x,bounds.y+point.y);await page.waitForFunction(midi=>document.querySelector('.home-2d-host')?.dataset.lastMidi===String(midi),point.midi);
}
// Impact frames are deliberately brief. Retain rendered evidence rather than
// requiring the browser driver to poll inside the 480ms mallet window.
async function watchHomeMallet(page,selector){
  await page.evaluate(selector=>{
    window.__malletObserver?.disconnect();window.__malletSeen=[];
    const host=document.querySelector(selector);
    window.__malletObserver=new MutationObserver(()=>{
      if(Number(host.dataset.malletCount)>0){window.__malletSeen.push({height:Number(host.dataset.malletHeight),source:host.dataset.malletSource,frames:JSON.parse(host.dataset.malletFrames||'[]'),contacts:JSON.parse(host.dataset.contacts||'[]')});window.__malletSeen=window.__malletSeen.slice(-64);}
    });
    window.__malletObserver.observe(host,{attributes:true,attributeFilter:['data-frames']});
  },selector);
}
async function renderedPitches(page,midis){
  return page.evaluate(async midis=>{
    const {BellAudio}=await import('./audio.mjs'),answers=[];
    const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;
    if(!Offline)return {available:false,reason:'This browser test build has no offline Web Audio API',realtimeAvailable:!!(window.AudioContext||window.webkitAudioContext)};
    for(const midi of midis){
      const context=new Offline(1,96000,48000),audio=new BellAudio();audio.context=context;audio.master=context.createGain();audio.master.gain.value=.24;audio.master.connect(context.destination);audio.unlock=async()=>{};
      await audio.strike(midi);const buffer=await context.startRendering(),data=buffer.getChannelData(0),start=2400,n=18000;
      let best=-Infinity,note=0;
      for(let candidate=48;candidate<=100;candidate++){
        const f=440*2**((candidate-69)/12),coefficient=2*Math.cos(2*Math.PI*f/48000);let s0=0,s1=0,s2=0;
        for(let i=0;i<n;i++){s0=data[start+i]*(.5-.5*Math.cos(2*Math.PI*i/(n-1)))+coefficient*s1-s2;s2=s1;s1=s0;}
        const power=s1*s1+s2*s2-coefficient*s1*s2;if(power>best){best=power;note=candidate;}
      }
      audio.stop();audio.context=null;audio.dispose();answers.push({midi,measuredMidi:note});
    }
    return {available:true,notes:answers};
  },midis);
}
async function playMidi(page,midi){
  const tags=JSON.parse(await page.locator('.main-performance-surface').getAttribute('data-note-plaques'));
  const tag=tags.find(tag=>tag.midi===midi&&tag.region==='center')||tags.find(tag=>tag.midi===midi);assert.ok(tag,`Visible contact for MIDI ${midi}`);await hit(page,tag.id,tag.region,midi);
}
async function settled(page){await page.locator('.home-2d-host[data-poster-source]').waitFor();await homeHit(page);}
async function shot(page,name){await page.screenshot({path:resolve(output,name+'.png'),fullPage:false});}
async function test(browser,engine,name,run,options={}){
  if(selectedCases&&!selectedCases.includes(name))return;
  const context=await browser.newContext({viewport:{width:1440,height:900},...options});const page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()));
  // Observe actual context creation, including callers outside the app's datasets.
  await context.addInitScript(()=>{window.__qaContexts=[];window.__qaGL=[];const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){const context=original.call(this,type,...args);if(type==='webgl'||type==='webgl2'){window.__qaContexts.push(type);if(context&&!window.__qaGL.includes(context))window.__qaGL.push(context);}return context;};});
  const started=Date.now();
  try{const details=await run(page,context,requests);assert.deepEqual(errors,[],'No uncaught page errors');report.results.push({engine,name,passed:true,ms:Date.now()-started,details});console.log('PASS',engine,name,Date.now()-started,'ms');}
  catch(error){await shot(page,`${engine}-${name}-FAILED`).catch(()=>{});report.results.push({engine,name,passed:false,step:page.__yimingStep,error:error.stack,errors});console.error('FAIL',engine,name,page.__yimingStep||'',error.stack);}
  finally{await context.close();await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');}
}
async function core(browser,engine){
  await test(browser,engine,'yanhua-library-and-practice',async(page,context,requests)=>{
    await open(page,'library');const row=page.locator('.song-list [data-song-id="yanhua-yi-leng"]');
    await row.locator('.song-info').click();assert.equal(await row.getAttribute('data-playable'),'true');
    assert.equal(await row.locator('.song-preview').isDisabled(),false);assert.match(await row.locator('.song-inline-preview').textContent(),/28 小节正文/);
    await shot(page,`${engine}-yanhua-library-zh`);
    await row.locator('.song-practice').click();await page.locator('.bell-app[data-phase="wait"]').waitFor();
    assert.equal(await page.locator('.phrase-strip .is-rest').count(),1);assert.ok(await page.locator('.phrase-strip .is-rest').isDisabled());
    assert.equal(await page.locator('.phrase-strip .score-note[aria-current="step"]').getAttribute('aria-label'),'试听简谱 3，音名 e¹，0.5 拍');
    await page.locator('.notation-toggle:visible').first().click();
    for(const [i,midi] of [64,64,67].entries()){await playMidi(page,midi);await page.locator(`.bell-app[data-step="${i+1}"]`).waitFor();}
    await page.locator('.bell-app[data-phase="done"]').waitFor();
    await page.locator('.measure-select[aria-label="第 5 小节"]').click();
    assert.equal(await page.locator('.measure.selected .is-tie').count(),2);assert.equal(await page.locator('.measure.selected .is-rest').count(),1);
    await page.locator('.measure-select[aria-label="第 21 小节"]').click();assert.equal(await page.locator('.measure.selected .is-grace').count(),2);
    await page.locator('.score-aside-actions .primary').click();await page.locator('.bell-app[data-phase="wait"]').waitFor();
    for(const [i,midi] of [76,74,76,76,76].entries()){await playMidi(page,midi);await page.locator(`.bell-app[data-step="${i+1}"]`).waitFor();}
    await page.locator('.bell-app[data-phase="done"]').waitFor();
    await page.locator('.measure-select[aria-label="第 23 小节"]').click();await playMidi(page,81);await shot(page,`${engine}-yanhua-score-with-dots`);
    await page.setViewportSize({width:390,height:844});await shot(page,`${engine}-yanhua-phone-score`);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.getByRole('button',{name:'切换为英文',exact:true}).click();assert.match(await page.locator('.play-topline h1').textContent(),/Yan Hua Yi Leng/);
    await nav(page,1);assert.match(await page.locator('.song-list [data-song-id="yanhua-yi-leng"] .song-info strong').textContent(),/Sheet excerpt/);
    assert.equal(await page.locator('.song-list [data-song-id^="zhuzhi-ci"]').count(),2);
    assert.equal(requests.filter(heavy).length,0);
    return {bars:29,strikes:154,restDisabled:true,tiesNotRestruck:true,graceNotes:[76,74,76]};
  });
  if(engine==='chromium')await test(browser,engine,'yanhua-full-listen',async(page,context,requests)=>{
    await open(page,'library');
    await page.evaluate(async()=>{const {PerformanceScene}=await import('./performance.mjs'),original=PerformanceScene.prototype.strikeMidi;window.__yanhuaMidi=[];PerformanceScene.prototype.strikeMidi=function(midi,...args){window.__yanhuaMidi.push(midi);return original.call(this,midi,...args);};});
    await page.locator('.song-list [data-song-id="yanhua-yi-leng"] .song-preview').click();
    await page.locator('.bell-app[data-phase="listen"]').waitFor();
    await page.waitForFunction(()=>document.querySelector('.main-performance-surface')?.dataset.lastMidi==='64');
    await page.locator('.notation-toggle:visible').first().click();
    assert.equal(await page.locator('.bell-app').getAttribute('data-phase'),'listen');assert.equal(await page.locator('.bell-app').getAttribute('data-paused'),'false');
    await page.locator('.bell-app[data-phase="free"]').waitFor({timeout:100000});
    const history=await page.evaluate(async()=>{const {yanhuaYiLeng:s}=await import('./data/yanhua-yi-leng.mjs');const e=document.querySelector('.main-performance-surface');return {count:Number(e.dataset.eventCount),last:Number(e.dataset.lastMidi),audio:Number(e.dataset.audioNotesStarted),duration:s.durationMs,actual:window.__yanhuaMidi,expected:s.events.map(n=>n.midi)};});
    // The scene intentionally keeps only its last 128 events. Check all 154
    // actual MIDI dispatches independently, including the ornaments and ties.
    assert.deepEqual(history.actual,history.expected);assert.equal(history.last,76);assert.equal(history.count,128);assert.ok(history.audio>=154);
    assert.equal(history.duration,88831);assert.match(await page.locator('.phrase-status strong').textContent(),/试听结束/);
    await shot(page,`${engine}-yanhua-full-listen-completed`);assert.equal(requests.filter(heavy).length,0);
    return {...history,realTimePlayback:true};
  });
  await test(browser,engine,'numbered-notation',async(page,context,requests)=>{
    await open(page,'play');const surface=page.locator('.main-performance-surface');
    await surface.locator('.strike-target').first().waitFor({state:'attached'});
    const toggle=()=>page.locator('.notation-toggle:visible').first();
    assert.equal(await toggle().getAttribute('aria-pressed'),'false');
    await hit(page,'bell-4-c','center',60);
    await page.evaluate(async()=>{const {BellAudio}=await import('./audio.mjs');window.__notationStops=0;const stop=BellAudio.prototype.stop;BellAudio.prototype.stop=function(...args){window.__notationStops++;return stop.apply(this,args);};});
    const targets=await surface.getAttribute('data-targets'),contacts=await surface.getAttribute('data-contacts');
    await toggle().click();await page.waitForFunction(()=>document.querySelector('.main-performance-surface')?.dataset.notation==='numbered');
    assert.equal(await surface.getAttribute('data-targets'),targets);assert.equal(await surface.getAttribute('data-contacts'),contacts);
    assert.equal(await page.evaluate(()=>window.__notationStops),0,'Notation does not stop a ringing bell');
    const liveAudio=await page.evaluate(()=>!!(window.AudioContext||window.webkitAudioContext));
    if(liveAudio)assert.match(await page.locator('.phrase-status strong').textContent(),/^1 ·/,'Existing feedback switches too');
    else report.limits.push(`${engine}: this test build has no Web Audio API; its sound-unavailable notice takes priority over strike feedback.`);
    const plaques=JSON.parse(await surface.getAttribute('data-note-plaques'));
    for(const [id,center,side,sideOctave] of [['c','1','3',0],['d','2','4',0],['g','5','7',0],['a','6','1',1]]){
      assert.equal(plaques.find(t=>t.id===`bell-4-${id}`&&t.region==='center').text,center);
      const sides=plaques.filter(t=>t.id===`bell-4-${id}`&&t.region!=='center');assert.equal(sides.length,2);
      assert.ok(sides.every(t=>t.text===side&&t.octave===sideOctave));
    }
    await shot(page,`${engine}-numbered-desktop-c`);
    await nav(page,1);await page.getByRole('button',{name:'开始第一句',exact:true}).click();
    await page.locator('.bell-app[data-phase="wait"]').waitFor();
    assert.equal(await surface.getAttribute('data-notation'),'numbered','Mode survives navigation');
    assert.equal(await page.locator('.target-caption .numbered-pitch').getAttribute('aria-label'),'6，下加 1 点');
    await toggle().click();assert.match(await page.locator('.target-caption').textContent(),/6 · a/);
    assert.equal(await page.locator('.bell-app').getAttribute('data-step'),'0');assert.equal(await page.locator('.bell-app').getAttribute('data-paused'),'false');
    await toggle().click();
    for(const [index,midi] of [57,62,62,60,62].entries()){await playMidi(page,midi);await page.locator(`.bell-app[data-step="${index+1}"]`).waitFor();}
    await page.locator('.bell-app[data-phase="done"]').waitFor();
    await page.getByRole('button',{name:'录钟曲',exact:true}).click();await page.locator('.bell-app[data-recording="true"]').waitFor();
    await playMidi(page,60);await toggle().click();await playMidi(page,64);await toggle().click();await playMidi(page,72);
    assert.equal(await page.locator('.bell-app').getAttribute('data-recording'),'true');
    await page.locator('.is-recording').click();await page.getByLabel('曲名',{exact:true}).fill('Notation continuity');await page.getByRole('button',{name:'保存钟曲',exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ymqn:3d:v1:works'))[0].events.map(e=>e.midi)),[60,64,72]);
    await page.goto(`${base}?lang=zh&score=zhuzhi-ci-recording#play`);await surface.waitFor();await toggle().click();
    await page.waitForFunction(()=>document.querySelector('.main-performance-surface')?.dataset.notation==='numbered');
    assert.equal(await surface.getAttribute('data-notation-key'),'F');assert.equal(await page.locator('.notation-key:visible').first().textContent(),'1=F');
    const fPlaques=JSON.parse(await surface.getAttribute('data-note-plaques'));
    assert.ok(fPlaques.some(t=>t.midi===65&&t.text==='1'&&t.octave===0));assert.ok(fPlaques.some(t=>t.midi===71&&t.text==='♯4'));
    await hit(page,'bell-4-g','right',71);await shot(page,`${engine}-numbered-desktop-f`);
    assert.equal(requests.filter(heavy).length,0);return {keys:['C','F'],recordedMidi:[60,64,72],audioTailPreserved:true};
  });
  await test(browser,engine,'numbered-phone-layouts',async(page,context,requests)=>{
    const dimensions=[[1440,900],[390,844],[320,568],[844,390],[568,320],[932,430]];
    for(const lang of ['zh','en'])for(const [width,height] of dimensions){
      page.__yimingStep=`numbered ${lang} ${width}x${height}`;
      await page.setViewportSize({width,height});await open(page,'play',lang);
      const surface=page.locator('.main-performance-surface');await surface.locator('.strike-target').first().waitFor({state:'attached'});
      await page.waitForFunction(()=>{const surface=document.querySelector('.main-performance-surface'),canvas=surface?.querySelector('.main-bells'),layout=JSON.parse(surface?.dataset.layout||'{}');return canvas&&Math.abs(canvas.getBoundingClientRect().width-layout.width)<1;});
      const notationToggle=page.locator('.notation-toggle:visible').first();
      // Same-document #play navigation may preserve the user's last mode.
      if(await notationToggle.getAttribute('aria-pressed')==='true')await notationToggle.click();
      await notationToggle.click();
      await page.waitForFunction(()=>document.querySelector('.main-performance-surface')?.dataset.notation==='numbered');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
      for(const control of await page.locator('.app-header button:visible,.play-layout-controls button:visible').all()){
        const box=await control.boundingBox();assert.ok(box.x>=-.5&&box.x+box.width<=width+.5,`Visible control fits ${lang} ${width}x${height}`);
      }
      const toggle=await page.locator('.notation-toggle:visible').first().boundingBox();assert.ok(toggle.width>=44&&toggle.height>=44);
      const layout=JSON.parse(await surface.getAttribute('data-layout'));assert.equal(layout.columns,4);assert.deepEqual(layout.issues,[]);
      await hit(page,`bell-${layout.low}-a`,'right',(layout.low+2)*12);
      await shot(page,`${engine}-numbered-${lang}-${width}x${height}`);
    }
    assert.equal(requests.filter(heavy).length,0);
  });
  await test(browser,engine,'default-and-audio',async(page,context,requests)=>{
    await open(page);await settled(page);assert.equal(await modelSwitch(page).isChecked(),false);
    assert.equal(requests.filter(heavy).length,0);assert.deepEqual(await page.evaluate(()=>window.__qaContexts),[]);
    await homeHit(page,'left');await homeHit(page,'right');await homeHit(page);await page.waitForFunction(()=>Number(document.querySelector('.home-2d-host')?.dataset.malletCount)>0);
    await shot(page,engine+'-home-2d-mallet');await page.waitForTimeout(1000);
    const count=await page.locator('.home-2d-host').getAttribute('data-frames');await page.waitForTimeout(180);assert.equal(await page.locator('.home-2d-host').getAttribute('data-frames'),count,'No idle painting');
    await nav(page,0);await page.locator('.main-performance-surface').waitFor();await page.locator('.bank-picker select:visible').first().selectOption('3');
    for(const [octave,center,side] of [[3,48,52],[4,60,64],[5,72,76]]){
      await hit(page,`bell-${octave}-c`,'center',center);await hit(page,`bell-${octave}-c`,'left',side);await hit(page,`bell-${octave}-c`,'right',side);
    }
    for(const [letter,center,side] of [['c',60,64],['d',62,65],['g',67,71],['a',69,72]]){
      await hit(page,`bell-4-${letter}`,'center',center);await hit(page,`bell-4-${letter}`,'left',side);await hit(page,`bell-4-${letter}`,'right',side);
    }
    const keys=JSON.parse(await page.locator('.main-performance-surface').getAttribute('data-layout')).octaves;
    const row=keys.indexOf(4),keyboard=['1234','qwer','asdf'][row];assert.ok(keyboard);
    for(const [column,midi] of [[0,64],[1,65],[2,71],[3,72]]){await page.keyboard.press('Shift+'+keyboard[column]);await page.waitForFunction(note=>document.querySelector('.main-performance-surface')?.dataset.lastMidi===String(note),midi);}
    await page.locator('.bank-picker select:visible').first().selectOption('4');await hit(page,'bell-6-a','right',96);await shot(page,engine+'-play-c7');
    const frequency=await renderedPitches(page,[48,52,60,64,72,76,67,65,66,71,74,98]);if(frequency.available)assert.ok(frequency.notes.every(p=>p.midi===p.measuredMidi),'Actual rendered sound matches the specified notes');
    else report.limits.push(`${engine}: ${frequency.reason}; realtime audio available: ${frequency.realtimeAvailable}. Audio measurements remain unverified on this engine.`);
    return {frequency};
  });
  await test(browser,engine,'opt-in-lifecycle',async(page,context,requests)=>{
    await open(page);await settled(page);await modelSwitch(page).check();
    await page.waitForFunction(()=>['ready','unsupported','error'].includes(document.querySelector('.home-object')?.dataset.modelState),{},{timeout:35000});
    const state=await page.locator('.home-object').getAttribute('data-model-state');assert.ok(['ready','unsupported'].includes(state),'A supported engine must reach a real first frame');
    if(state==='ready'){
      // Retain evidence from actual rendered frames: a software GPU can render
      // this finite mallet between two Playwright polling callbacks.
      await page.evaluate(()=>{window.__qaMalletFrames=[];const host=document.querySelector('.home-canvas-host');new MutationObserver(()=>{if(Number(host.dataset.malletCount)>0)window.__qaMalletFrames.push(host.dataset.frames);}).observe(host,{attributes:true,attributeFilter:['data-frames']});});
      await page.locator('.audition-steps button').first().click();await page.waitForFunction(()=>window.__qaMalletFrames.length>0);await shot(page,engine+'-home-3d-mallet');
      await page.getByRole('button',{name:'重听落钟声'}).click();await page.locator('.home-canvas-host[data-arrival="descending"]').waitFor();assert.equal(await page.locator('.home-canvas-host').getAttribute('data-mallet-count'),'0');
      await page.locator('.audition-steps button').last().click();await page.locator('.home-canvas-host[data-arrival="settled"]').waitFor({timeout:1000});
      await nav(page,2);await page.locator('.home-object[data-model-state="ready"]').waitFor();await page.getByRole('button',{name:'剖视',exact:true}).click();await page.locator('.home-canvas-host[data-section-loops]').waitFor();
      await shot(page,engine+'-section-3d');
    }
    const downloads=requests.filter(url=>url.endsWith('/single-bell.glb')).length;assert.equal(downloads,1,'One page-scoped model download');
    await modelSwitch(page).uncheck();await page.locator('.home-object[data-model-state="off"]').waitFor();assert.equal(await page.locator('.home-canvas-host canvas').count(),0);
    assert.ok(await page.evaluate(()=>window.__qaGL.every(context=>context.isContextLost())),'Closed scenes release their GPU contexts');
    for(let n=0;n<2;n++){await modelSwitch(page).check();await page.locator('.home-object[data-model-state="ready"],.home-object[data-model-state="unsupported"]').waitFor();await modelSwitch(page).uncheck();await page.locator('.home-object[data-model-state="off"]').waitFor();}
    assert.equal(requests.filter(url=>url.endsWith('/single-bell.glb')).length,1,'Repeated switches reuse bytes');
    await page.reload();await page.locator('.home-object[data-model-state="off"]').waitFor();assert.equal(await modelSwitch(page).isChecked(),false);
    assert.equal(requests.filter(url=>url.endsWith('/single-bell.glb')).length,1,'Refresh does not silently re-enable 3D');return {threeD:state};
  });
  await test(browser,engine,'observation-2d',async(page,context,requests)=>{
    await open(page,'observe');await page.locator('.home-2d-host[data-poster-source]').waitFor();await page.getByRole('button',{name:'钟腔',exact:true}).click();
    await page.locator('.home-2d-host[data-section-source]').waitFor();assert.equal(await page.getByRole('button',{name:'剖视',exact:true}).count(),0);
    await shot(page,engine+'-section-2d');assert.equal(requests.filter(heavy).length,0);assert.deepEqual(await page.evaluate(()=>window.__qaContexts),[]);
  });
  await test(browser,engine,'phone-layouts',async(page,context,requests)=>{
    await page.setViewportSize({width:390,height:844});await open(page,'home','en');await settled(page);
    const switchBounds=await page.locator('.model-switch').boundingBox();assert.ok(switchBounds.height>=44);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot(page,engine+'-phone-home');
    await page.locator('.home-actions .primary').click();const surface=page.locator('.main-performance-surface');await surface.waitFor();
    let layout=JSON.parse(await surface.getAttribute('data-layout'));assert.ok([4,8,12].includes(layout.rows*4));assert.equal(layout.columns,4);
    await shot(page,engine+'-phone-portrait');await page.setViewportSize({width:844,height:390});
    await page.waitForTimeout(150);layout=JSON.parse(await surface.getAttribute('data-layout'));assert.ok([4,8,12].includes(layout.rows*4));assert.equal(layout.columns,4);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot(page,engine+'-phone-landscape');assert.equal(requests.filter(heavy).length,0);
  });
  await test(browser,engine,'header-model-switch',async(page,context,requests)=>{
    for(const [width,height,view] of [[1440,900,'home'],[390,844,'home'],[320,568,'home'],[320,568,'observe'],[740,360,'observe']]){
      await page.setViewportSize({width,height});await open(page,view);await page.locator('.app-header .model-switch').waitFor();
      assert.equal(await page.locator('.home-object .model-mode-controls').count(),0);
      const control=await page.locator('.model-switch').boundingBox(),bar=await page.locator('.app-header').boundingBox();assert.ok(control.y>=bar.y&&control.y+control.height<=bar.y+bar.height+1,'3D stays within the header');assert.ok(control.width>=44&&control.height>=44,'44px touch area');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      for(const rectangle of await page.locator('.app-header button,.model-switch').evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length).map(node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right};})))assert.ok(rectangle.left>=0&&rectangle.right<=width,'Visible header controls fit the viewport');
      await shot(page,`${engine}-header-${view}-${width}`);
    }
    assert.equal(requests.filter(heavy).length,0);
  });
  await test(browser,engine,'legacy-recordings',async(page,context)=>{
    const work={id:'legacy-check',title:'Compatibility take',durationMs:1600,events:[{midi:64,time:0,region:'left',bellId:'bell-4-e'},{midi:71,time:650,region:'right',bellId:'bell-4-b'}]};
    await context.addInitScript(value=>localStorage.setItem('ymqn:3d:v1:works',JSON.stringify([value])),work);await open(page,'works');
    await page.getByRole('button',{name:/播放.*Compatibility take/}).click();
    await page.waitForFunction(()=>document.querySelector('.main-performance-surface')?.dataset.lastMidi==='64');assert.equal(await page.locator('.main-performance-surface').getAttribute('data-last-region'),'left');
    await page.waitForFunction(()=>document.querySelector('.main-performance-surface')?.dataset.lastMidi==='71');assert.equal(await page.locator('.main-performance-surface').getAttribute('data-last-region'),'right');
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ymqn:3d:v1:works'))),[work]);
  });
  await test(browser,engine,'practice-and-recording',async(page,context,requests)=>{
    await open(page,'library');const titles=await page.locator('.song-list .song-info strong').allTextContents();assert.ok(titles.includes('竹枝词 · 简版')&&titles.includes('竹枝词 · 完整版'));
    await page.getByRole('button',{name:'开始第一句',exact:true}).click();await page.locator('.bell-app[data-phase="wait"]').waitFor();
    const notes=await page.evaluate(async()=>{const {measuresFor}=await import('./practice-model.mjs');return measuresFor(window.YMQNSongs.find(song=>song.id==='zhuzhi-ci'))[0].notes.map(note=>note.midi);});
    const wrong=JSON.parse(await page.locator('.main-performance-surface').getAttribute('data-note-plaques')).find(tag=>tag.midi!==notes[0]);await hit(page,wrong.id,wrong.region,wrong.midi);assert.equal(await page.locator('.bell-app').getAttribute('data-step'),'0');
    for(let index=0;index<notes.length;index++){await playMidi(page,notes[index]);await page.locator(`.bell-app[data-step="${index+1}"]`).waitFor();}await page.locator('.bell-app[data-phase="done"]').waitFor();
    await page.getByRole('button',{name:'录钟曲',exact:true}).click();await page.locator('.bell-app[data-recording="true"]').waitFor();for(const midi of [60,67,74])await playMidi(page,midi);
    await page.locator('.is-recording').click();await page.getByLabel('曲名',{exact:true}).fill('New paired recording');await page.getByRole('button',{name:'保存钟曲',exact:true}).click();
    await nav(page,3);await page.getByRole('button',{name:'修改New paired recording的曲名',exact:true}).click();await page.getByLabel('曲名',{exact:true}).fill('Renamed paired recording');await page.getByRole('button',{name:'保存曲名',exact:true}).click();
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ymqn:3d:v1:works')));assert.equal(saved[0].title,'Renamed paired recording');assert.deepEqual(saved[0].events.map(event=>event.midi),[60,67,74]);assert.equal(requests.filter(heavy).length,0);
  });
  await test(browser,engine,'four-bell-focus-and-availability',async(page,context,requests)=>{
    const dimensions=[[1440,900],[390,844],[360,740],[320,568],[844,390],[932,430]];
    for(const [width,height] of dimensions){
      page.__yimingStep=`four-bell ${width}x${height}`;
      await page.setViewportSize({width,height});await open(page,'play');
      const surface=page.locator('.main-performance-surface');await surface.locator('.strike-target').first().waitFor({state:'attached'});
      await page.locator('.bank-picker select:visible').first().selectOption('4');
      await page.waitForFunction(()=>{const el=document.querySelector('.main-performance-surface'),layout=JSON.parse(el.dataset.layout),rect=el.getBoundingClientRect();return layout.low===4&&Math.abs(layout.width-rect.width)<1&&Math.abs(layout.height-rect.height)<1;});
      // Read the responsive layout and its targets in one browser frame: a
      // ResizeObserver can legitimately change the row count between RPCs.
      const snapshot=await surface.evaluate(el=>({layout:JSON.parse(el.dataset.layout),count:el.querySelectorAll('.strike-target').length,targets:JSON.parse(el.dataset.targets)}));
      let layout=snapshot.layout;
      assert.equal(layout.columns,4);assert.equal(layout.displayRows,layout.rows);assert.deepEqual(layout.issues,[]);
      assert.equal(snapshot.count,layout.rows*8);
      assert.ok(snapshot.targets.every(t=>t.width>=44&&t.height>=44));
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      for(const button of await page.locator('.app-header button:visible,.play-layout-controls button:visible').all()){
        const box=await button.boundingBox();assert.ok(box.x>=-.5&&box.x+box.width<=width+.5,`Visible toolbar control stays on screen at ${width}x${height}`);
      }
      await hit(page,'bell-4-c','left',64);
      await page.locator('.focus-register:visible').first().click();
      await page.waitForFunction(()=>JSON.parse(document.querySelector('.main-performance-surface').dataset.layout).rows===1);
      await page.locator('.bank-picker select:visible').first().selectOption('6');await hit(page,'bell-6-a','right',96);
      await page.locator('.mute-control').click();const notes=Number(await surface.getAttribute('data-audio-notes-started'));
      await page.locator('.focus-register:visible').first().click();
      layout=JSON.parse(await surface.getAttribute('data-layout'));
      await hit(page,`bell-${layout.low}-c`,'right',(layout.low+1)*12+4);
      assert.equal(Number(await surface.getAttribute('data-audio-notes-started')),notes,'Layout changes preserve mute');
      await page.locator('.mute-control').click();
      await page.waitForTimeout(160);await shot(page,`${engine}-four-${width}x${height}`);
    }
    await nav(page,1);const missing=page.locator('.song-list .song-row[data-playable="false"]');assert.equal(await missing.count(),1);
    assert.match(await missing.locator('.song-info strong').textContent(),/晴天/);
    assert.ok(await missing.locator('.song-preview').isDisabled());assert.ok(await missing.locator('.song-practice').isDisabled());
    await missing.locator('.song-info').click();assert.ok(await page.locator('.library-score-actions .primary').isDisabled());
    await shot(page,`${engine}-four-missing-pitches-zh`);
    await page.getByRole('button',{name:'切换为英文',exact:true}).click();
    assert.match(await missing.locator('.pitch-availability').textContent(),/Missing pitches: F♯4/);
    assert.ok(await page.locator('.library-score-actions .primary').isDisabled());
    assert.equal(await page.locator('.song-list [data-song-id^="zhuzhi-ci"]').count(),2);
    assert.equal(requests.filter(heavy).length,0);return {dimensions,fourBellsPerRow:true,missingPitchScore:'Qing Tian'};
  });
  await test(browser,engine,'legacy-audio-only-pitches',async(page,context)=>{
    const work={id:'old-chromatic',title:'Old pitch take',durationMs:1550,events:[{midi:64,time:0,region:'left',bellId:'bell-4-e'},{midi:66,time:220,region:'right',bellId:'bell-4-f'},{midi:71,time:440,region:'right',bellId:'bell-4-b'},{midi:98,time:660,region:'right',bellId:'bell-6-b'}]};
    await context.addInitScript(value=>{
      localStorage.setItem('ymqn:3d:v1:works',JSON.stringify([value]));window.__legacyFrequencies=[];
      const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
      const create=Audio.prototype.createOscillator;
      Audio.prototype.createOscillator=function(){const oscillator=create.call(this),start=oscillator.start.bind(oscillator);oscillator.start=(...args)=>{window.__legacyFrequencies.push(oscillator.frequency.value);return start(...args);};return oscillator;};
    },work);
    await open(page,'works');
    await page.evaluate(async()=>{
      const {BellAudio}=await import('./audio.mjs'),strike=BellAudio.prototype.strike;
      window.__legacyDispatched=[];window.__legacyOutcomes=[];window.__legacyContexts=[];
      BellAudio.prototype.strike=async function(midi,...args){
        window.__legacyDispatched.push(midi);
        try{const pending=strike.call(this,midi,...args);if(this.context&&!window.__legacyContexts.includes(this.context))window.__legacyContexts.push(this.context);const started=await pending;window.__legacyOutcomes.push({midi,started});return started;}
        catch(error){window.__legacyOutcomes.push({midi,error:error.name,message:error.message});throw error;}
      };
    });
    await page.getByRole('button',{name:/播放.*Old pitch take/}).click();await page.locator('.bell-app[data-phase="work"]').waitFor();
    await page.locator('.bell-app[data-phase="free"]').waitFor();
    const frequencies=await page.evaluate(()=>window.__legacyFrequencies);let offline;
    assert.deepEqual(await page.evaluate(()=>window.__legacyDispatched),work.events.map(event=>event.midi),'Replay dispatch preserves every historical MIDI, including unavailable rack pitches');
    if(frequencies.length){assert.equal(frequencies.length,12);work.events.forEach((event,index)=>assert.ok(Math.abs(frequencies[index*3]-440*2**((event.midi-69)/12))<.1,'Legacy F-sharp and D7 keep their absolute frequency'));}
    else{
      const capability=await page.evaluate(()=>({api:!!(window.AudioContext||window.webkitAudioContext),states:window.__legacyContexts.map(context=>context.state),outcomes:window.__legacyOutcomes}));
      assert.ok(!capability.api||capability.states.length>0&&capability.states.every(state=>state!=='running')||capability.outcomes.some(outcome=>['NotSupportedError','NotAllowedError','InvalidStateError','AbortError'].includes(outcome.error)),`A running audio context must produce oscillators: ${JSON.stringify(capability)}`);
      offline=await renderedPitches(page,work.events.map(event=>event.midi));
      if(offline.available)assert.ok(offline.notes.every(note=>note.midi===note.measuredMidi),'Headless replay still verifies the actual rendered frequency for every dispatched legacy pitch');
      report.limits.push(`${engine}: realtime legacy audio did not start: ${JSON.stringify(capability)}. MIDI dispatch and stored events verified; offline rendered pitch verification: ${offline.available}.`);
    }
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ymqn:3d:v1:works'))),[work]);
    assert.equal(await page.locator('.main-performance-surface').getAttribute('data-last-midi'),'71','Unavailable D7 does not highlight a different bell');
    return {events:work.events.map(e=>e.midi),realtimeAudioVerified:frequencies.length>0,offline};
  });
  await test(browser,engine,'home-mallet-parity',async(page,context)=>{
    page.__yimingStep='2D artwork';
    await open(page);await settled(page);const flat=page.locator('.home-2d-host'),model=page.locator('.home-canvas-host');
    await flat.locator(':scope').waitFor();await page.locator('.home-2d-host[data-mallet-source]').waitFor();
    const source=await flat.getAttribute('data-mallet-source');assert.match(source,/bell-mallet-v10\.(webp|png)$/);
    await watchHomeMallet(page,'.home-2d-host');await homeHit(page);await page.waitForFunction(()=>window.__malletSeen.length>0);
    const desktopHeight=await page.evaluate(()=>window.__malletSeen[0].height);await shot(page,engine+'-matched-mallet-2d');
    page.__yimingStep='3D artwork loading';
    await modelSwitch(page).check();await page.locator('.home-object[data-model-state="ready"],.home-object[data-model-state="unsupported"]').waitFor({timeout:35000});
    if(await page.locator('.home-object').getAttribute('data-model-state')==='unsupported')return {threeD:'unsupported'};
    await page.waitForFunction(expected=>document.querySelector('.home-canvas-host').dataset.malletSource===expected,source);
    await page.evaluate(async()=>{
      const THREE=await import('./vendor/three.module.min.js');window.__homeMalletSamples=[];
      const before=THREE.Sprite.prototype.onBeforeRender;
      THREE.Sprite.prototype.onBeforeRender=function(...args){before?.apply(this,args);if(this.renderOrder===10){window.__homeMalletSamples.push({source:this.material.map.image.src,toneMapped:this.material.toneMapped,center:this.center.toArray(),opacity:this.material.opacity});window.__homeMalletSamples=window.__homeMalletSamples.slice(-64);}};
      const after=THREE.Sprite.prototype.onAfterRender;
      THREE.Sprite.prototype.onAfterRender=function(...args){after?.apply(this,args);if(this.renderOrder===10&&!window.__homeMalletProof)window.__homeMalletProof=args[0].domElement.toDataURL('image/png');};
      const afterScene=THREE.Scene.prototype.onAfterRender;
      THREE.Scene.prototype.onAfterRender=function(renderer,...args){afterScene?.call(this,renderer,...args);const size=renderer.getSize(new THREE.Vector2());window.__homeRenderedViewport={width:size.x,height:size.y};};
    });
    for(const [index,region] of [[0,'center'],[1,'left']]){
      page.__yimingStep=`3D ${region} impact`;await watchHomeMallet(page,'.home-canvas-host');
      await page.locator('.audition-steps button').nth(index).click();
      const sample=await page.waitForFunction(region=>{const seen=window.__malletSeen.find(seen=>seen.frames.some(frame=>frame.region===region));return seen?{frame:seen.frames.findLast(frame=>frame.region===region),contact:seen.contacts.find(p=>p.region===region)}:false;},region);
      const {frame,contact}=await sample.jsonValue(),side=region==='left'?-1:1;
      assert.equal(frame.height,desktopHeight);
      assert.ok(Math.abs(frame.x-side*(1-frame.alpha)*16-contact.x)<1&&Math.abs(frame.y-(1-frame.alpha)*18-contact.y)<1,'Mallet head follows the actual projected strike and the same 2D recoil');
      assert.equal(frame.width/frame.height,143/640);await shot(page,engine+'-matched-mallet-3d-'+region);
    }
    const proof=await page.evaluate(()=>window.__homeMalletProof);assert.ok(proof);await writeFile(resolve(output,engine+'-matched-mallet-3d-layer.png'),Buffer.from(proof.split(',')[1],'base64'));
    const material=await page.evaluate(()=>window.__homeMalletSamples.at(-1));assert.ok(material);assert.match(material.source,/bell-mallet-v10\.(webp|png)$/);assert.equal(material.toneMapped,false);assert.deepEqual(material.center,[.5,.86]);
    page.__yimingStep='3D zoom and rapid strikes';
    await page.locator('.home-object').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('+');
    await watchHomeMallet(page,'.home-canvas-host');await page.locator('.audition-steps button').first().click();await page.waitForFunction(()=>window.__malletSeen.length>0);assert.equal(await page.evaluate(()=>window.__malletSeen[0].height),desktopHeight);
    for(let n=0;n<8;n++)await page.locator('.audition-steps button').nth(n%2).click();assert.ok(Number(await model.getAttribute('data-mallet-count'))<=3);
    await page.waitForFunction(()=>{const host=document.querySelector('.home-canvas-host'),frames=host.dataset.frames,previous=window.__malletIdleProbe;if(!previous||previous.frames!==frames){window.__malletIdleProbe={frames,at:performance.now()};return false;}return host.dataset.malletCount==='0'&&performance.now()-previous.at>240;},null,{timeout:4000});
    const frames=await model.getAttribute('data-frames');await page.waitForTimeout(150);assert.equal(await model.getAttribute('data-frames'),frames,'3D feedback stops rendering when quiet');
    page.__yimingStep='mobile 3D impact';
    await page.getByRole('button',{name:'正面',exact:true}).click();
    await page.evaluate(()=>window.__homeRenderedViewport=null);await page.setViewportSize({width:390,height:844});
    await page.waitForFunction(()=>window.__homeRenderedViewport?.width===390&&document.querySelector('.home-canvas-host canvas').getBoundingClientRect().width<=390);
    await watchHomeMallet(page,'.home-canvas-host');
    const contacts=JSON.parse(await model.getAttribute('data-contacts')),p=contacts.find(point=>point.region==='center'),bounds=await model.locator('canvas').boundingBox();
    const target=await page.evaluate(({x,y})=>{const element=document.elementFromPoint(x,y),focus=document.querySelector('.home-object');return {x,y,element:element?.tagName,className:element?.className,inBell:focus.contains(element),focus:focus.getBoundingClientRect().toJSON()};},{x:bounds.x+p.x,y:bounds.y+p.y});
    assert.ok(target.inBell,`The rendered mobile strike point must reach the bell input: ${JSON.stringify(target)}`);
    await page.mouse.click(bounds.x+p.x,bounds.y+p.y);await page.waitForFunction(()=>window.__malletSeen.length>0);
    assert.equal(await page.evaluate(()=>window.__malletSeen[0].height),190);await shot(page,engine+'-matched-mallet-mobile-3d');
    page.__yimingStep='mobile 2D impact';
    await modelSwitch(page).uncheck();await page.locator('.home-object[data-model-state="off"]').waitFor();await watchHomeMallet(page,'.home-2d-host');await homeHit(page);
    await page.waitForFunction(()=>window.__malletSeen.length>0);assert.equal(await page.evaluate(()=>window.__malletSeen[0].height),190);
    assert.ok(await page.evaluate(()=>window.__qaGL.every(context=>context.isContextLost())));
    page.__yimingStep='missing artwork fallback';
    await page.route(/\/bell-mallet-v10\.(?:webp|png)$/,route=>route.fulfill({status:404,body:''}));await page.reload();await settled(page);
    await modelSwitch(page).check();await page.locator('.home-object[data-model-state="ready"]').waitFor({timeout:35000});
    assert.equal(await model.getAttribute('data-mallet-source'),'local-outline');
    await watchHomeMallet(page,'.home-canvas-host');
    const fallback=JSON.parse(await model.getAttribute('data-contacts')).find(point=>point.region==='center'),fallbackBounds=await model.locator('canvas').boundingBox();await page.mouse.click(fallbackBounds.x+fallback.x,fallbackBounds.y+fallback.y);
    await page.waitForFunction(()=>window.__malletSeen.length>0);
    return {source,desktopHeight,mobileHeight:190,sharedArtwork:true,fallbackVisible:true};
  });
}
async function faults(browser){
  const engine='chromium';
  await test(browser,engine,'png-fallback',async page=>{
    await page.route(/\/(?:bell-|home-bell-).*\.webp$/,route=>route.fulfill({status:200,contentType:'image/webp',body:'invalid WebP'}));
    await open(page);await settled(page);assert.match(await page.locator('.home-2d-host').getAttribute('data-poster-source'),/\.png$/);
    await nav(page,0);await page.locator('.main-performance-surface[data-middle-source]').waitFor();
    assert.match(await page.locator('.main-performance-surface').getAttribute('data-middle-source'),/\.png$/);await hit(page,'bell-4-g','center',67);
  });
  await test(browser,engine,'all-images-fail',async page=>{
    await page.route(/\/(?:bell-|home-bell-).*\.(?:webp|png)$/,route=>route.fulfill({status:404,body:''}));
    await open(page);await page.locator('.home-2d-host[data-asset-errors="2"]').waitFor();await homeHit(page);
    await nav(page,0);await page.locator('.main-performance-surface[data-asset-errors="4"]').waitFor();await hit(page,'bell-4-d','right',65);
    assert.ok(await page.locator('.asset-retry').isVisible());const pixels=await page.locator('.main-bells').evaluate(canvas=>{const d=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let count=0;for(let i=3;i<d.length;i+=4)if(d[i])count++;return count;});assert.ok(pixels>10000);await shot(page,'all-images-local-placeholder');
  });
  await test(browser,engine,'model-404',async page=>{
    let failed=false;await page.route('**/single-bell.glb',route=>{if(failed)return route.continue();failed=true;return route.fulfill({status:404,body:''});});await open(page);await settled(page);await modelSwitch(page).check();
    await page.locator('.home-object[data-model-state="error"]').waitFor();await homeHit(page,'right');await page.locator('.model-state button').click();await page.locator('.home-object[data-model-state="ready"]').waitFor();
    await nav(page,0);await hit(page,'bell-4-g','center',67);
  });
  await test(browser,engine,'progressive-images',async page=>{
    let release;const gate=new Promise(resolve=>release=resolve);await page.route('**/bell-small-v2.webp',async route=>{await gate;await route.continue().catch(()=>{});});
    try{
      await open(page,'play');await page.locator('.main-performance-surface[data-middle-source][data-bottom-source]').waitFor();assert.equal(await page.locator('.main-performance-surface').getAttribute('data-top-source'),null);
      await hit(page,'bell-4-g','center',67);release();await page.locator('.main-performance-surface[data-top-source]').waitFor();
    }finally{release();}
  });
  await test(browser,engine,'webgl-unavailable',async(page,context)=>{
    await context.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl2')throw new Error('WebGL context unavailable');return original.call(this,type,...args);};});
    await open(page);await settled(page);await modelSwitch(page).check();await page.locator('.home-object[data-model-state="unsupported"]').waitFor();await homeHit(page);assert.equal(await page.locator('.home-canvas-host canvas').count(),0);
  });
  await test(browser,engine,'late-download-and-navigation',async page=>{
    let release;const gate=new Promise(resolve=>release=resolve);let requested=false;
    await page.route('**/single-bell.glb',async route=>{requested=true;await gate;await route.continue().catch(()=>{});});
    await open(page);await settled(page);await modelSwitch(page).check();await page.waitForFunction(()=>document.querySelector('.home-object')?.dataset.modelState==='loading');
    await homeHit(page,'left');await nav(page,0);assert.ok(requested);await hit(page,'bell-4-g','center',67);release();
    await page.waitForTimeout(250);assert.equal(await page.locator('.home-canvas-host canvas').count(),0);await nav(page,2);await page.locator('.home-object[data-model-state="ready"]').waitFor({timeout:35000});
  });
  await test(browser,engine,'first-frame-error',async page=>{
    const source=await readFile(new URL('../app/home-bell-scene.mjs',import.meta.url),'utf8');assert.ok(source.includes('this.renderer.render(this.scene,this.camera);'));
    await page.route('**/home-bell-scene.mjs',route=>route.fulfill({contentType:'text/javascript',body:source.replace('this.renderer.render(this.scene,this.camera);','throw new Error("Injected render failure");')}));
    await open(page);await settled(page);await modelSwitch(page).check();await page.locator('.home-object[data-model-state="error"]').waitFor();await homeHit(page);assert.equal(await page.locator('.home-canvas-host canvas').count(),0);
  });
  await test(browser,engine,'cancel-during-load-and-retry',async(page,context,requests)=>{
    let release;const gate=new Promise(resolve=>release=resolve);let attempted=false;
    await page.route('**/single-bell.glb',async route=>{if(!attempted){attempted=true;await gate;}await route.continue().catch(()=>{});});
    try{
      await open(page);await settled(page);await modelSwitch(page).check();await page.locator('.home-object[data-model-state="loading"]').waitFor();
      await modelSwitch(page).uncheck();await page.locator('.home-object[data-model-state="off"]').waitFor();release();await page.waitForTimeout(200);
      assert.equal(await page.locator('.home-canvas-host canvas').count(),0);await homeHit(page,'right');
      await modelSwitch(page).check();await page.locator('.home-object[data-model-state="ready"]').waitFor({timeout:35000});assert.equal(requests.filter(url=>url.endsWith('/single-bell.glb')).length,2);
    }finally{release();}
  });
  await test(browser,engine,'context-loss-and-retry',async page=>{
    await open(page);await settled(page);await modelSwitch(page).check();await page.locator('.home-object[data-model-state="ready"]').waitFor();
    await page.evaluate(()=>window.__qaGL.at(-1).getExtension('WEBGL_lose_context').loseContext());
    await page.locator('.home-object[data-model-state="error"]').waitFor();await homeHit(page,'left');assert.equal(await page.locator('.home-canvas-host canvas').count(),0);
    await page.locator('.model-state button').click();await page.locator('.home-object[data-model-state="ready"]').waitFor();
    const count=await page.locator('.home-canvas-host').getAttribute('data-frames');await page.waitForTimeout(180);assert.equal(await page.locator('.home-canvas-host').getAttribute('data-frames'),count);
  });
  await test(browser,engine,'arrival-interrupt-and-audio-tail',async page=>{
    await open(page);await page.locator('.home-2d-host[data-poster-source]').waitFor();
    await page.locator('.home-object').focus();await page.keyboard.press('Enter');await page.locator('.home-2d-host[data-last-midi="60"]').waitFor();
    await page.getByRole('button',{name:'重听落钟声'}).click();await page.locator('.home-2d-host[data-arrival="descending"]').waitFor();assert.equal(await page.locator('.home-hit-hint').isVisible(),false);
    await page.locator('.home-2d-host[data-arrival="dust"]').waitFor();assert.equal(await page.locator('.home-2d-host').getAttribute('data-landing-sounds'),'1');
    await page.evaluate(async()=>{const {BellAudio}=await import('./audio.mjs');window.__qaAudioStops=0;const original=BellAudio.prototype.stop;BellAudio.prototype.stop=function(...args){window.__qaAudioStops++;return original.apply(this,args);};});
    await modelSwitch(page).check();await page.locator('.home-object[data-model-state="ready"]').waitFor();await modelSwitch(page).uncheck();await page.locator('.home-object[data-model-state="off"]').waitFor();assert.equal(await page.evaluate(()=>window.__qaAudioStops),0,'Display mode changes preserve fading audio');
    await homeHit(page);await page.waitForTimeout(950);const count=await page.locator('.home-2d-host').getAttribute('data-frames');await page.waitForTimeout(200);assert.equal(await page.locator('.home-2d-host').getAttribute('data-frames'),count);
  });
  await test(browser,engine,'timeout-and-switch-cancel',async page=>{
    let release;const gate=new Promise(resolve=>release=resolve);await page.route('**/single-bell.glb',async route=>{await gate;await route.continue().catch(()=>{});});
    await open(page);await settled(page);await modelSwitch(page).check();await page.locator('.home-object[data-model-state="error"]').waitFor({timeout:35000});await homeHit(page);
    await modelSwitch(page).uncheck();await page.locator('.home-object[data-model-state="off"]').waitFor();release();await page.waitForTimeout(150);assert.equal(await page.locator('.home-canvas-host canvas').count(),0);
  });
  await test(browser,engine,'reduced-motion-and-idle',async page=>{
    await open(page);await settled(page);assert.equal(await page.locator('.home-2d-host').getAttribute('data-mallet-count'),'0');
    // The reduced-motion strike keeps a finite fading contact ring (820 ms).
    await page.waitForTimeout(950);const before=await page.locator('.home-2d-host').getAttribute('data-frames');await page.waitForTimeout(200);assert.equal(await page.locator('.home-2d-host').getAttribute('data-frames'),before);
  },{reducedMotion:'reduce'});
  await test(browser,engine,'input-cancel-and-visibility-simulation',async page=>{
    await open(page);await settled(page);const before=await page.locator('.home-2d-host').getAttribute('data-last-region');
    await page.locator('.home-object').evaluate(element=>{const r=element.getBoundingClientRect(),data={bubbles:true,pointerId:81,pointerType:'touch',button:0,clientX:r.x+r.width*.25,clientY:r.y+r.height*.8};for(const name of ['pointerdown','pointercancel','pointerup'])element.dispatchEvent(new PointerEvent(name,data));});
    assert.equal(await page.locator('.home-2d-host').getAttribute('data-last-region'),before,'Cancelled home touches do not strike');
    for(let n=0;n<8;n++)await page.locator('.audition-steps button').nth(n%2).click();assert.ok(Number(await page.locator('.home-2d-host').getAttribute('data-mallet-count'))<=3);
    await nav(page,0);await hit(page,'bell-4-g','center',67);
    await page.locator('.main-bells').evaluate(canvas=>{const r=canvas.getBoundingClientRect(),data={bubbles:true,pointerId:82,pointerType:'touch',button:0,clientX:r.x+r.width*.5,clientY:r.y+r.height*.7};canvas.dispatchEvent(new PointerEvent('pointerdown',data));canvas.dispatchEvent(new PointerEvent('pointercancel',data));});
    assert.equal(await page.locator('.main-performance-surface').getAttribute('data-active-pointers'),'0');
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    const count=await page.locator('.main-bells').getAttribute('data-frame-count');await page.waitForTimeout(180);assert.equal(await page.locator('.main-bells').getAttribute('data-frame-count'),count);
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});await hit(page,'bell-4-d','center',62);
    return {visibility:'Synthetic visibilitychange; physical background/foreground remains a device check.'};
  });
}
const choices={chromium:[chromium,{}],chrome:[chromium,{channel:'chrome'}],edge:[chromium,{channel:'msedge'}],firefox:[firefox,{}],webkit:[webkit,{}]};
const selected=(process.env.YIMING_BROWSERS||(process.platform==='win32'?'chromium,chrome,edge,firefox,webkit':'chromium,firefox,webkit')).split(',');
try{
  for(const name of selected){
    const [type,options]=choices[name]||[];assert.ok(type,`Unknown browser ${name}`);let browser;
    try{browser=await type.launch({headless:true,...options});}
    catch(error){report.engines.push({name,available:false,error:error.message});console.log('UNAVAILABLE',name,error.message.split('\n')[0]);if(process.env.YIMING_REQUIRE_BROWSERS==='1')report.results.push({engine:name,name:'launch',passed:false,error:error.message});continue;}
    report.engines.push({name,available:true,version:browser.version()});
    await core(browser,name);if(name==='chromium')await faults(browser);await browser.close();
  }
}finally{server?.kill();await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');}
const failures=report.results.filter(result=>!result.passed);console.log(`BROWSER RESULT: ${report.results.length-failures.length} passed, ${failures.length} failed.`);console.log('BROWSER LIMITS:',JSON.stringify(report.limits));if(failures.length||!report.results.length)process.exitCode=1;
