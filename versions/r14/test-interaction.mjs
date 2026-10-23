import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {Transport,scoreEvents,practiceSections,rangeFits,pitchRange,WORKS_KEY} from './session.mjs';
import {BellAudio} from './audio.mjs';
import {BellScene} from './scene.mjs';

let checks=0;
function check(value,message){assert.ok(value,message);checks++;}
const songs={};songs.window=songs;
for(const path of ['data/licensed-songs.js','data/songs.js'])vm.runInNewContext(await readFile(new URL(path,import.meta.url),'utf8'),songs);
for(const song of songs.YMQNSongs){
  const events=scoreEvents(song,.72);
  for(const rows of [1,2,3]){
    const sections=practiceSections(events,rows);
    check(JSON.stringify(sections.flatMap(p=>p.events.map(e=>e.midi)))===JSON.stringify(events.map(e=>e.midi)),`${song.id}: no dropped, reordered or transposed practice notes`);
    check(sections.every(p=>rangeFits(p.events,{rows,low:p.low})),`${song.id}: each practice section has every note visible`);
    check(sections.every(p=>p.events.every((e,i)=>Math.abs(events[p.offset+i].time-(e.time+p.origin))<.001)),`${song.id}: preserve original rhythm within sections to sub-microsecond precision`);
  }
}
const qing=songs.YMQNSongs.find(s=>s.id==='licensed-qing-tian');
check(practiceSections(scoreEvents(qing,.72),2).length===1,'Qing Tian fits two fixed registers with no bank change');
check(practiceSections(scoreEvents(qing,.72),1).length>1,'one-register devices explicitly use continuous practice sections');
check(pitchRange([{midi:60},{midi:83}]).low===4&&pitchRange([{midi:60},{midi:83}]).high===5,'register boundaries');
check(scoreEvents({events:[{midi:64,time:1234,region:'left'}]},.72)[0].time===1234,'stored event timing and actual strike region are not retimed');
check(WORKS_KEY==='ymqn:3d:v1:works','recording identity unchanged');

// The same public scene methods must not reframe instruments when a target or
// off-screen accompaniment note changes. No WebGL or DOM is needed here.
let changed=0,notes=0;
const stationary={bells:[],options:{mode:'play',active:true},layout:{rows:2,low:4},
  setOptions(){changed++;},audio:{strike(){notes++;return Promise.resolve();}}};
check(BellScene.prototype.ensureBell.call(stationary,{id:'offscreen'})===undefined&&changed===0,'no automatic register switching');
BellScene.prototype.strikeMidi.call({...stationary,ensureBell:BellScene.prototype.ensureBell},48,'playback',.22);
check(changed===0&&notes===1,'off-screen accompaniment is audio-only');

// Deterministic transport clock: count-in, hit uniqueness, pause/resume,
// interruption cancellation and bounded periodic scheduling.
const original={performance:globalThis.performance,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
let now=0,id=0;const tasks=new Map();
globalThis.performance={now:()=>now};
globalThis.setTimeout=(fn,delay=0)=>{const token=++id;tasks.set(token,{fn,time:now+Math.max(0,delay)});return token;};
globalThis.clearTimeout=token=>tasks.delete(token);
function advance(ms){
  const end=now+ms;
  while(true){const first=[...tasks].filter(([,v])=>v.time<=end).sort((a,b)=>a[1].time-b[1].time||a[0]-b[0])[0];if(!first)break;now=first[1].time;tasks.delete(first[0]);first[1].fn();}
  now=end;
}
try{
  const t=new Transport(),targets=[],ticks=[];let finished=0;
  const events=[{midi:60,time:0},{midi:60,time:500},{midi:64,time:1000}];
  t.play(events,{follow:true,beatMs:500,onTarget:(_,i)=>targets.push(i),onTick:v=>ticks.push(v),onEnd:()=>finished++});
  check(ticks[0].countIn===4,'four real beats before following');
  advance(2000);
  check(t.judge(60,now)&&!t.judge(60,now),'one hit per actual rhythmic event, no repeat-scoring pulse');
  check(!t.judge(64,now),'wrong and premature notes do not score');
  advance(100);t.pause();const position=t.position,count=targets.length,tickCount=ticks.length;
  advance(5000);check(t.paused&&!t.running&&t.position===position&&targets.length===count&&ticks.length===tickCount,'pause freezes time, score and cue callbacks');
  check(!t.judge(60,now),'paused performance cannot receive a scored hit');
  t.resume();advance(400);check(t.judge(60,now),'resume retains remaining rhythmic interval');
  check(t.hits.size===2,'resume preserves prior hits');
  advance(500);check(t.judge(64,now),'later notes stay in the same musical order');
  advance(900);check(finished===1&&!t.running&&tasks.size===0,'completion stops every scheduled callback');
  t.play(events,{follow:false,onNote:()=>{throw Error('cancelled callback');}});t.stop();advance(5000);
  check(tasks.size===0,'stop cancels pending notes and ticker');
}finally{Object.assign(globalThis,original);}

const node=()=>({gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},frequency:{value:0},connect(to){return to;},disconnect(){},start(){},stop(){}});
class AudioMock{constructor(){this.state='running';this.destination=node();this.currentTime=0;}createGain(){return node();}createDynamicsCompressor(){return node();}createOscillator(){return node();}resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}close(){return Promise.resolve();}}
const originalWindow=globalThis.window,originalDocument=globalThis.document;
globalThis.window={AudioContext:AudioMock};globalThis.document={hidden:false};
try{
  const audio=new BellAudio();
  for(let i=0;i<10;i++)await audio.strike(60+i,0,.8);
  check(audio.voices.length===10,'bounded manual polyphony');
  check(!await audio.strike(48,0,.22)&&audio.voices.length===10,'backing does not evict ten fresh manual voices');
  await audio.strike(72,0,.85);check(audio.voices.length===10,'new manual note replaces an older voice within the cap');
  let idleCallback;const nativeTimeout=globalThis.setTimeout;
  try{
    globalThis.setTimeout=(fn,delay,...args)=>delay===8000?(idleCallback=fn,0):nativeTimeout(fn,delay,...args);
    for(const voice of [...audio.voices])audio.stopVoice(voice);
  }finally{globalThis.setTimeout=nativeTimeout;}
  check(typeof idleCallback==='function','empty audio graph has a bounded idle-suspend timer');
  idleCallback();await audio.suspending;
  check(audio.context.state==='suspended','idle audio processing stops');
  await audio.unlock();check(audio.context.state==='running','a later user gesture can resume idle audio');
  audio.stop();check(audio.voices.length===0,'stop releases oscillators and gain nodes');
  audio.setMuted(true);check(!await audio.strike(60),'mute prevents new sounds');
  audio.dispose();
}finally{if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;}

const lod=JSON.parse(await readFile(new URL('./models/performance-r7-report.json',import.meta.url),'utf8'));
const shell=lod.meshes.find(m=>m.names.includes('Bell_C'));
check(shell.after<6000&&shell.before>30000,'mobile LOD reduces sculpt tessellation without replacing the source model');
check(shell.names.length===7&&lod.bytes<3*1024*1024,'seven sizes share a bounded payload');
console.log(`${checks} interaction, transport, audio and LOD checks passed`);
