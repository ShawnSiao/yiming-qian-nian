import {scoreMeasures} from './score-workspace.mjs';
import {isPairedPitch} from './paired-instrument.mjs';

export function measuresFor(song){return scoreMeasures(song).map(m=>({...m,notes:m.notes.filter(n=>Number.isInteger(n.midi)&&!n.tie)}));}
export function practiceBank(notes,rows=2){
  const midis=notes.map(n=>n.midi),min=Math.min(...midis),max=Math.max(...midis);
  for(let low=3;low<=7-rows;low++)if(min>=(low+1)*12&&max<=(low+rows+1)*12)return {low,fits:midis.every(isPairedPitch)};
  return {low:Math.max(3,Math.min(7-rows,Math.floor(min/12)-1)),fits:false};
}
export function practiceHit({index,notes,paused=false,phase},midi){
  if(phase!=='wait'||paused)return {index,accepted:false,done:false};
  if(notes[index]?.midi!==midi)return {index,accepted:false,done:false};
  const next=index+1;return {index:next,accepted:true,done:next===notes.length};
}
export function phraseEvents(notes,bpm=64,sourceBpm=bpm){
  const firstTime=notes[0]?.timeMs,scale=sourceBpm/bpm;
  let time=0;return notes.map(n=>{const onset=Number.isFinite(firstTime)&&Number.isFinite(n.timeMs)?(n.timeMs-firstTime)*scale:time;const event={midi:n.midi,time:onset,duration:(n.duration||1)*60000/bpm,velocity:n.velocity??.85};time=onset+event.duration;return event;});
}
