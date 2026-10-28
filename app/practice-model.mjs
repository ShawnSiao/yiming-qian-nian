import {scoreMeasures} from './score-workspace.mjs';
import {pitchFitsBank} from './paired-instrument.mjs';

export function measuresFor(song){return scoreMeasures(song).map(m=>{
  let index=0;const displayNotes=m.notes.map(n=>({...n,playIndex:Number.isInteger(n.midi)&&!n.tie?index++:null}));
  return {...m,displayNotes,notes:displayNotes.filter(n=>n.playIndex!==null)};
});}
export function practiceBank(notes,rows=2){
  const midis=notes.map(n=>n.midi),min=Math.min(...midis);
  for(let low=3;low<=7-rows;low++)if(midis.every(midi=>pitchFitsBank(midi,low,rows)))return {low,fits:true};
  return {low:Math.max(3,Math.min(7-rows,Math.floor(min/12)-1)),fits:false};
}
export function practiceHit({index,notes,paused=false,phase},midi){
  if(phase!=='wait'||paused)return {index,accepted:false,done:false};
  if(notes[index]?.midi!==midi)return {index,accepted:false,done:false};
  const next=index+1;return {index:next,accepted:true,done:next===notes.length};
}
export function phraseEvents(notes,bpm=64,sourceBpm=bpm){
  const firstTime=notes[0]?.timeMs,scale=sourceBpm/bpm;
  let time=0;return notes.map(n=>{const onset=Number.isFinite(firstTime)&&Number.isFinite(n.timeMs)?(n.timeMs-firstTime)*scale:Number.isFinite(n.offset)?n.offset*60000/bpm:time;const event={midi:n.midi,time:onset,duration:(n.duration||1)*60000/bpm,velocity:n.velocity??.85};time=onset+event.duration;return event;});
}
