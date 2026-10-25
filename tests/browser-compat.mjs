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
  catch(error){await shot(page,`${engine}-${name}-FAILED`).catch(()=>{});report.results.push({engine,name,passed:false,error:error.stack,errors});console.log('FAIL',engine,name,error.message);}
  finally{await context.close();await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');}
}
async function core(browser,engine){
  await test(browser,engine,'default-and-audio',async(page,context,requests)=>{
    await open(page);await settled(page);assert.equal(await modelSwitch(page).isChecked(),false);
    assert.equal(requests.filter(heavy).length,0);assert.deepEqual(await page.evaluate(()=>window.__qaContexts),[]);
    await homeHit(page,'left');await homeHit(page,'right');await homeHit(page);await page.waitForFunction(()=>Number(document.querySelector('.home-2d-host')?.dataset.malletCount)>0);
    await shot(page,engine+'-home-2d-mallet');await page.waitForTimeout(1000);
    const count=await page.locator('.home-2d-host').getAttribute('data-frames');await page.waitForTimeout(180);assert.equal(await page.locator('.home-2d-host').getAttribute('data-frames'),count,'No idle painting');
    await nav(page,0);await page.locator('.main-performance-surface').waitFor();
    for(const [octave,center,side] of [[3,48,52],[4,60,64],[5,72,76]]){
      await hit(page,`bell-${octave}-c`,'center',center);await hit(page,`bell-${octave}-c`,'left',side);await hit(page,`bell-${octave}-c`,'right',side);
    }
    await hit(page,'bell-4-e','center',64);await hit(page,'bell-4-e','left',67);await hit(page,'bell-4-e','right',67);
    await hit(page,'bell-4-f','center',65);await hit(page,'bell-4-f','right',66);await hit(page,'bell-4-b','center',71);await hit(page,'bell-4-b','right',74);
    const keys=JSON.parse(await page.locator('.main-performance-surface').getAttribute('data-layout')).octaves;
    const row=keys.indexOf(4),keyboard=['1234567','qwertyu','asdfghj'][row];assert.ok(keyboard);
    for(const [column,midi] of [[2,67],[3,66],[6,74]]){await page.keyboard.press('Shift+'+keyboard[column]);await page.waitForFunction(note=>document.querySelector('.main-performance-surface')?.dataset.lastMidi===String(note),midi);}
    await page.locator('.bank-picker select').first().selectOption('4');await hit(page,'bell-6-b','right',98);await shot(page,engine+'-play-d7');
    const frequency=await page.evaluate(async()=>{
      const {BellAudio}=await import('./audio.mjs'),answers=[];
      const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;
      if(!Offline)return {available:false,reason:'This browser test build has no offline Web Audio API',realtimeAvailable:!!(window.AudioContext||window.webkitAudioContext)};
      for(const midi of [48,52,60,64,72,76,67,65,66,71,74,98]){
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
    });if(frequency.available)assert.ok(frequency.notes.every(p=>p.midi===p.measuredMidi),'Actual rendered sound matches the specified notes');
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
      await page.locator('.audition-steps button').last().click();await page.locator('.home-canvas-host[data-arrival="settled"]').waitFor();
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
    let layout=JSON.parse(await surface.getAttribute('data-layout'));assert.ok([7,14,21].includes(layout.rows*7));
    await shot(page,engine+'-phone-portrait');await page.setViewportSize({width:844,height:390});
    await page.waitForTimeout(150);layout=JSON.parse(await surface.getAttribute('data-layout'));assert.ok([7,14,21].includes(layout.rows*7));
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
    await page.waitForFunction(()=>document.querySelector('.main-performance-surface')?.dataset.lastMidi==='64');assert.equal(await page.locator('.main-performance-surface').getAttribute('data-last-region'),'center');
    await page.waitForFunction(()=>document.querySelector('.main-performance-surface')?.dataset.lastMidi==='71');assert.equal(await page.locator('.main-performance-surface').getAttribute('data-last-region'),'center');
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
}
async function faults(browser){
  const engine='chromium';
  await test(browser,engine,'png-fallback',async page=>{
    await page.route(/\/(?:bell-|home-bell-).*\.webp$/,route=>route.fulfill({status:200,contentType:'image/webp',body:'invalid WebP'}));
    await open(page);await settled(page);assert.match(await page.locator('.home-2d-host').getAttribute('data-poster-source'),/\.png$/);
    await nav(page,0);await page.locator('.main-performance-surface[data-middle-source]').waitFor();
    assert.match(await page.locator('.main-performance-surface').getAttribute('data-middle-source'),/\.png$/);await hit(page,'bell-4-e','right',67);
  });
  await test(browser,engine,'all-images-fail',async page=>{
    await page.route(/\/(?:bell-|home-bell-).*\.(?:webp|png)$/,route=>route.fulfill({status:404,body:''}));
    await open(page);await page.locator('.home-2d-host[data-asset-errors="2"]').waitFor();await homeHit(page);
    await nav(page,0);await page.locator('.main-performance-surface[data-asset-errors="4"]').waitFor();await hit(page,'bell-4-f','right',66);
    assert.ok(await page.locator('.asset-retry').isVisible());const pixels=await page.locator('.main-bells').evaluate(canvas=>{const d=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let count=0;for(let i=3;i<d.length;i+=4)if(d[i])count++;return count;});assert.ok(pixels>10000);await shot(page,'all-images-local-placeholder');
  });
  await test(browser,engine,'model-404',async page=>{
    let failed=false;await page.route('**/single-bell.glb',route=>{if(failed)return route.continue();failed=true;return route.fulfill({status:404,body:''});});await open(page);await settled(page);await modelSwitch(page).check();
    await page.locator('.home-object[data-model-state="error"]').waitFor();await homeHit(page,'right');await page.locator('.model-state button').click();await page.locator('.home-object[data-model-state="ready"]').waitFor();
    await nav(page,0);await hit(page,'bell-4-e','right',67);
  });
  await test(browser,engine,'progressive-images',async page=>{
    let release;const gate=new Promise(resolve=>release=resolve);await page.route('**/bell-small-v2.webp',async route=>{await gate;await route.continue().catch(()=>{});});
    try{
      await open(page,'play');await page.locator('.main-performance-surface[data-middle-source][data-bottom-source]').waitFor();assert.equal(await page.locator('.main-performance-surface').getAttribute('data-top-source'),null);
      await hit(page,'bell-4-e','right',67);release();await page.locator('.main-performance-surface[data-top-source]').waitFor();
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
    await homeHit(page,'left');await nav(page,0);assert.ok(requested);await hit(page,'bell-4-e','right',67);release();
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
    await nav(page,0);await hit(page,'bell-4-e','right',67);
    await page.locator('.main-bells').evaluate(canvas=>{const r=canvas.getBoundingClientRect(),data={bubbles:true,pointerId:82,pointerType:'touch',button:0,clientX:r.x+r.width*.5,clientY:r.y+r.height*.7};canvas.dispatchEvent(new PointerEvent('pointerdown',data));canvas.dispatchEvent(new PointerEvent('pointercancel',data));});
    assert.equal(await page.locator('.main-performance-surface').getAttribute('data-active-pointers'),'0');
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    const count=await page.locator('.main-bells').getAttribute('data-frame-count');await page.waitForTimeout(180);assert.equal(await page.locator('.main-bells').getAttribute('data-frame-count'),count);
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});await hit(page,'bell-4-b','right',74);
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
const failures=report.results.filter(result=>!result.passed);console.log(`BROWSER RESULT: ${report.results.length-failures.length} passed, ${failures.length} failed.`);if(failures.length||!report.results.length)process.exitCode=1;
