import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {Transport,scoreEvents,sectionAccompaniment,practiceSections,rangeFits} from './session.mjs';
const song=JSON.parse(await readFile(new URL('./scores/zhuzhi-ci-recording.json',import.meta.url),'utf8'));
let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++;};
const runtime={window:{}};
for(const name of ['licensed-songs','zhuzhi-recording','songs'])vm.runInNewContext(await readFile(new URL(`./data/${name}.js`,import.meta.url),'utf8'),runtime);
check(runtime.window.YMQNSongs.filter(s=>s.id===song.id).length===1,'one full-span entry is built into the library');
check(runtime.window.YMQNSongs.find(s=>s.id==='zhuzhi-ci').title==='竹枝词 · 简版'&&song.title==='竹枝词 · 完整版','retain explicitly named short and full versions');
check(song.transcriptionStatus==='draft-needs-musician-review'&&!song.analysis.expertAuditoryReview,'do not claim expert listening or an authoritative full arrangement');
check(song.sourceDurationMs===153000&&song.durationMs===153000,'retain the full source window including its tail');
check(song.scoreKey==='F'&&song.jianpuBars.length===32,'full 1=F notation draft, not eight repeated bars');
check(song.listenEvents.length===song.analysis.totalAttacks,'every retained attack is in complete audition');
check(song.events.length===song.analysis.foregroundAttacks,'practice foreground is explicit');
check(song.listenEvents.filter(e=>e.velocity<.45).length===song.analysis.supportAttacks,'reference attacks are not silently omitted');
check(song.listenEvents.filter(e=>e.uncertain).length===54,'preserve all unresolved attack marks');
check(new Set(song.listenEvents.map(e=>`${e.onsetMs}:${e.midi}`)).size===song.listenEvents.length,'no duplicated synthesized attacks');
for(const [i,e] of song.listenEvents.entries()){
  check(Number.isInteger(e.midi)&&e.midi>=48&&e.midi<=95,'every attack is playable without octave folding');
  check(e.onsetMs>=0&&e.durationMs>0&&e.onsetMs+e.durationMs<=153000,'source-aligned onset and tail bounds');
  check(!i||e.onsetMs>song.listenEvents[i-1].onsetMs,'strict chronological attack line');
}
for(const bar of song.jianpuBars)for(const n of bar){
  check(n.offset>=0&&n.offset+n.duration<=4.001,'notation fragments stay in their measure');
  check(n.degree>=1&&n.degree<=7&&Math.abs(n.octave)<=2,'numbered notation has explicit octave position');
}
for(const rate of [.6,.72,1]){
  const timed=scoreEvents(song,rate);
  check(timed.every((e,i)=>Math.abs(e.time-song.events[i].onsetMs/rate)<.0001),'practice scales actual timing, not an invented fixed beat');
  for(const rows of [1,2,3]){
    const parts=practiceSections(timed,rows);
    check(parts.flatMap(p=>p.events).length===timed.length,'all foreground notes remain in practice');
    check(parts.every(p=>rangeFits(p.events,{rows,low:p.low})),'each practice bank contains every required pitch');
    check(parts.flatMap((part,i)=>sectionAccompaniment(song,rate,part,parts[i+1])).length===22,'section boundaries retain each reference attack once, including the tail');
  }
  check(practiceSections(timed,3).length===1,'three registers support uninterrupted full-song practice');
}
check(scoreEvents({events:[{time:1234,midi:60}]},.6)[0].time===1234,'old user recordings retain their exact timing');

// Decode the actual exported MIDI rather than only checking its extension.
const midi=await readFile(new URL('./scores/zhuzhi-ci-recording.mid',import.meta.url));
check(midi.toString('ascii',0,4)==='MThd'&&midi.readUInt16BE(12)===480,'standard 480-PPQ MIDI file');
let p=22,tick=0,noteOn=[],noteOff=0;const vlq=()=>{let n=0,b;do{b=midi[p++];n=(n<<7)|(b&127);}while(b&128);return n;};
while(p<midi.length){tick+=vlq();const status=midi[p++];if(status===255){const type=midi[p++],len=vlq();p+=len;if(type===47)break;}else{const pitch=midi[p++],velocity=midi[p++];if(status===144&&velocity)noteOn.push({pitch,time:tick*2.5});else noteOff++;}}
check(noteOn.length===185&&noteOff===185,'MIDI contains all attack on/off pairs');
check(noteOn.every((e,i)=>e.pitch===song.listenEvents[i].midi&&Math.abs(e.time-song.listenEvents[i].onsetMs)<=1.25),'MIDI pitches and actual onset timing match the score JSON');
check(tick*2.5===153000,'MIDI retains the complete 153-second duration');

// Exercise the entire score at three speeds with a deterministic clock,
// including a pause 20ms after an emitted note (no duplicate on resume).
const native={performance:globalThis.performance,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
let now=0,id=0;const tasks=new Map();
globalThis.performance={now:()=>now};globalThis.setTimeout=(fn,delay=0)=>{const key=++id;tasks.set(key,{fn,time:now+Math.max(0,delay)});return key;};globalThis.clearTimeout=key=>tasks.delete(key);
const advance=ms=>{const end=now+ms;while(true){const next=[...tasks].filter(([,v])=>v.time<=end).sort((a,b)=>a[1].time-b[1].time||a[0]-b[0])[0];if(!next)break;now=next[1].time;tasks.delete(next[0]);next[1].fn();}now=end;};
try{
  for(const rate of [.6,.72,1]){
    const events=scoreEvents(song,rate),backing=sectionAccompaniment(song,rate,{events,origin:0});
    const heard=[],reference=[];let ended=0;
    const player=new Transport();player.play(events,{onNote:(e,i)=>heard.push(i),onAccompaniment:e=>reference.push(e.time),accompaniment:backing,endTime:153000/rate,onEnd:()=>ended++});
    advance(90+events[40].time+20);player.pause();const h=heard.length,b=reference.length;advance(20000);
    check(heard.length===h&&reference.length===b&&!ended,'pause freezes the full-score transport');player.resume();advance(153000/rate+1000);
    check(heard.length===events.length&&new Set(heard).size===events.length,'full audition emits each foreground note exactly once across pause/resume');
    check(reference.length===backing.length&&ended===1&&!tasks.size,'full audition includes every reference attack and ends once');
    const targets=[];let done=0;const follow=new Transport();follow.play(events,{follow:true,beatMs:1200/rate,onTarget:(e,i)=>targets.push(i),onEnd:()=>done++,endTime:153000/rate});
    advance(153000/rate+4800/rate+1000);
    check(targets.length===events.length&&new Set(targets).size===events.length&&done===1,'full follow reaches the last note after count-in without auto-scoring');
    check(follow.hits.size===0&&!tasks.size,'unplayed notes are never counted as hits');
  }
}finally{Object.assign(globalThis,native);}
console.log(`${checks} full recording score, MIDI and transport checks passed`);
