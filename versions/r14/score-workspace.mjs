const C_MAJOR=[0,2,4,5,7,9,11];
export function pitchNotation(midi,key='C'){
  const tonic=key==='F'?65:60;
  const relative=((midi-tonic)%12+12)%12;
  let degree=C_MAJOR.indexOf(relative),accidental='';
  if(degree<0){degree=C_MAJOR.indexOf(relative-1);accidental='♯';}
  return {degree:degree+1,accidental,octave:Math.floor((midi-tonic)/12)};
}
// Original notation is preserved. Scores without notation are grouped into
// eight-event reading phrases, never presented as newly verified bar lines.
export function scoreMeasures(song){
  if(!song)return [];
  const key=song.scoreKey||'C',tonic=key==='F'?65:60;
  if(song.jianpuBars)return song.jianpuBars.map((bar,index)=>{
    let offset=0;
    const notes=bar.map(n=>{
      const beat=index*4+(n.offset??offset);offset+=n.duration;
      const midi=n.midi??tonic+C_MAJOR[n.degree-1]+(n.octave||0)*12;
      return {...n,midi,beat};
    });
    return {index,label:`第 ${index+1} 小节`,notes};
  });
  const measures=[];
  song.events.forEach((e,index)=>{
    const group=Math.floor(index/8);
    if(!measures[group])measures[group]={index:group,label:`第 ${group+1} 乐句`,notes:[]};
    measures[group].notes.push({...pitchNotation(e.midi,key),...e,duration:e.durationBeat||1,eventIndex:index});
  });
  return measures;
}
export function scoreLocation(song,eventIndex,measures=scoreMeasures(song)){
  const event=song?.events[eventIndex];if(!event)return {bar:0,beat:null,midi:null};
  const bar=measures.findIndex(m=>m.notes.some(n=>n.midi===event.midi&&Math.abs(n.beat-event.beat)<.001));
  return {bar:Math.max(0,bar),beat:event.beat,midi:event.midi};
}
export function workspaceSplit(width,fraction=.72){
  const available=Math.max(0,width-16),minimumStage=900;
  const panel=Math.min(760,Math.max(300,available*(1-fraction)),Math.max(0,available-minimumStage));
  return {stage:available-panel,panel,fraction:available?(available-panel)/available:.72};
}
export function clampSplitFraction(value){return Math.max(.56,Math.min(.86,value));}
