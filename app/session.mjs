// Preserve the R14/R15 same-origin recording identity. Locale does not alter it.
import {pitchLabel,pitchFitsBank,unsupportedPitches} from './paired-instrument.mjs';
export const WORKS_KEY='ymqn:3d:v1:works';
export function readWorks(){try{const v=JSON.parse(localStorage.getItem(WORKS_KEY)||'[]');return Array.isArray(v)?v.filter(w=>w&&Array.isArray(w.events)&&typeof w.title==='string').slice(0,30):[];}catch{return [];}}
export function saveWorks(works){try{localStorage.setItem(WORKS_KEY,JSON.stringify(works));return true;}catch{return false;}}
export function formatTime(ms){const s=Math.floor(Math.max(0,ms)/1000);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
export const noteName=pitchLabel;

export function scoreEvents(item,rate=1,source=item.events){
  return source.map(e=>({midi:e.midi,region:e.region,bellId:e.bellId,velocity:e.velocity??.85,
    time:e.onsetMs!==undefined?e.onsetMs/rate:e.time!==undefined?e.time:e.beat*60000/item.bpm/rate,
    duration:e.durationMs!==undefined?e.durationMs/rate:e.durationBeat?e.durationBeat*60000/item.bpm/rate:200}));
}
export function sectionAccompaniment(item,rate,part,nextPart){
  if(!item.listenEvents)return [];
  const last=part.events.at(-1);
  const end=nextPart?.origin??Math.max((item.sourceDurationMs||0)/rate,part.origin+(last?.time||0)+(last?.duration||0));
  return scoreEvents(item,rate,item.listenEvents.filter(e=>e.velocity<.45))
    .filter(e=>e.time>=part.origin&&(nextPart?e.time<end:e.time<=end))
    .map(e=>({...e,time:e.time-part.origin}));
}
export function pitchRange(events){
  const notes=events.map(e=>e.midi).filter(Number.isFinite);
  return {low:Math.floor(Math.min(...notes)/12)-1,high:Math.floor(Math.max(...notes)/12)-1};
}
export function rangeFits(events,layout){
  return events.every(e=>pitchFitsBank(e.midi,layout.low,layout.rows));
}
export function practiceBank(events,rows){
  if(!events.length)return 4;
  const preferred=Math.max(3,Math.min(pitchRange(events).low,7-rows));
  const banks=[preferred,...Array.from({length:5-rows},(_,i)=>i+3).filter(low=>low!==preferred)]
    .filter(low=>rangeFits(events,{low,rows}));
  const owned=low=>events.filter(e=>{const octave=Number(/^bell-([3-6])-[cdefgab]$/.exec(e.bellId||'')?.[1]);return octave>=low&&octave<low+rows;}).length;
  return banks.sort((a,b)=>owned(b)-owned(a)||Math.abs(a-preferred)-Math.abs(b-preferred))[0];
}
// Split only at an actual event boundary; never omit out-of-range notes in
// the middle of a phrase or retune them into the visible register.
export function practiceSections(events,rows){
  if(![1,2,3].includes(rows)||unsupportedPitches(events).length)throw new RangeError('Practice includes unavailable paired-bell pitches');
  const sections=[];let start=0;
  while(start<events.length){
    let end=start+1,low=practiceBank(events.slice(start,end),rows);
    while(end<events.length){
      const next=practiceBank(events.slice(start,end+1),rows);
      if(next===undefined)break;
      low=next;end++;
    }
    const origin=events[start].time;
    sections.push({events:events.slice(start,end).map(e=>({...e,time:e.time-origin})),origin,
      low,offset:start});
    start=end;
  }
  return sections;
}

export class Transport {
  constructor(){this.timers=[];this.generation=0;this.running=false;this.paused=false;this.position=0;this.hits=new Set();}
  clear(){this.generation++;this.timers.forEach(clearTimeout);this.timers=[];clearTimeout(this.tickTimer);this.tickTimer=0;}
  stop(){this.clear();this.running=false;this.paused=false;this.position=0;}
  pause(){if(!this.running)return;this.position=performance.now()-this.startAt;this.clear();this.running=false;this.paused=true;}
  resume(){if(!this.paused)return;this.running=true;this.paused=false;this.startAt=performance.now()-this.position;this.schedule();}
  play(events,options){
    this.stop();this.events=events;this.options=options;this.hits=new Set();this.delivered=new Set();this.backingDelivered=new Set();
    this.beatMs=options.beatMs||600;
    this.position=options.follow?-this.beatMs*4:-90;
    this.startAt=performance.now()-this.position;this.running=true;this.schedule();
  }
  schedule(){
    const generation=this.generation,position=this.position;
    const {onNote,onTarget,onEnd,onTick,onAccompaniment,follow=false,accompaniment=[]}=this.options;
    const schedule=(fn,time)=>this.timers.push(setTimeout(()=>{if(this.generation===generation&&this.running)fn();},Math.max(0,this.startAt+time-performance.now())));
    for(let index=0;index<this.events.length;index++){
      const event=this.events[index];
      if(event.time<position-120||this.delivered.has(index))continue;
      if(follow)schedule(()=>{this.delivered.add(index);onTarget?.(event,index);},event.time-350);
      else schedule(()=>{this.delivered.add(index);onNote?.(event,index);},event.time);
    }
    accompaniment.forEach((event,index)=>{if(event.time>=position&&!this.backingDelivered.has(index))schedule(()=>{this.backingDelivered.add(index);onAccompaniment?.(event);},event.time);});
    const tick=()=>{
      if(generation!==this.generation||!this.running)return;
      const elapsed=performance.now()-this.startAt;
      onTick?.({elapsed,countIn:elapsed<0?Math.max(1,Math.ceil(-elapsed/this.beatMs)):0,
        beat:((Math.floor(elapsed/this.beatMs)%4)+4)%4});
      this.tickTimer=setTimeout(tick,100);
    };tick();
    const last=this.events.at(-1);
    const endTime=Math.max((last?.time||0)+Math.max(850,last?.duration||0),this.options.endTime||0,
      ...accompaniment.map(e=>e.time+(e.duration||0)));
    schedule(()=>{this.running=false;this.clear();onEnd?.(this.hits.size);},endTime);
  }
  judge(midi,now){
    if(!this.running)return false;
    const elapsed=now-this.startAt;
    let best=-1,distance=Infinity;
    const window=Math.min(180,(this.beatMs||600)*.22);
    this.events.forEach((e,i)=>{const d=Math.abs(e.time-elapsed);if(e.midi===midi&&!this.hits.has(i)&&d<window&&d<distance){best=i;distance=d;}});
    if(best<0)return false;this.hits.add(best);return true;
  }
}
