const C_MAJOR=[0,2,4,5,7,9,11];
const TONICS={C:60,F:65,G:67};
export function pitchNotation(midi,key='C'){
  const tonic=TONICS[key]??60;
  const relative=((midi-tonic)%12+12)%12;
  let degree=C_MAJOR.indexOf(relative),accidental='';
  if(degree<0){degree=C_MAJOR.indexOf(relative-1);accidental='♯';}
  return {degree:degree+1,accidental,octave:Math.floor((midi-tonic)/12)};
}
// Original notation is preserved. Scores without notation are grouped into
// eight-event reading phrases, never presented as newly verified bar lines.
export function scoreMeasures(song){
  if(!song)return [];
  const key=song.scoreKey||'C',tonic=TONICS[key]??60;
  if(song.jianpuBars){
    let start=0;
    return song.jianpuBars.map((bar,index)=>{
      let offset=0;const notes=[],alterations=new Map(),startBeat=start,beats=index===0&&song.pickupBeats?song.pickupBeats:4;start+=beats;
      // Printed accidentals last for this degree and octave until the barline.
      // Rests and unpitched X marks never become synthesized pitches.
      const midiFor=n=>{
        if(!Number.isInteger(n.degree)||n.degree===0)return null;
        const slot=`${n.degree}:${n.octave||0}`;
        if(n.accidental)alterations.set(slot,({'♯':1,'♭':-1,'♮':0})[n.accidental]??0);
        return n.midi??tonic+C_MAJOR[n.degree-1]+(n.octave||0)*12+(alterations.get(slot)||0);
      };
      for(const n of bar){
        const onset=n.offset??offset;offset=onset+n.duration;
        const graces=n.graceNotes||[],graceBeat=.125;
        graces.forEach((g,i)=>notes.push({...g,midi:midiFor(g),beat:startBeat+onset+i*graceBeat,offset:onset+i*graceBeat,duration:graceBeat,velocity:.65,grace:true}));
        const delay=graces.length*graceBeat,midi=midiFor(n);
        notes.push({...n,midi,beat:startBeat+onset+delay,offset:onset+delay,duration:n.duration-delay,...(delay?{notatedDuration:n.duration}:{} )});
      }
      return {index,label:`第 ${index+1} 小节`,notes,startBeat,beats};
    });
  }
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
