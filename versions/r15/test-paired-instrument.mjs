import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {BELL_PAIRS,pairedBellAt,pairedPositionForMidi,pitchLabel,unsupportedPitches,registerLabel} from './paired-instrument.mjs';
import {performanceLayout,performanceContact} from './performance-layout.mjs';
import {scoreEvents,practiceSections,practiceBank,rangeFits,noteName,WORKS_KEY} from './session.mjs';
import {frequency} from './model.mjs';
let checks=0;const check=(v,label)=>{assert.ok(v,label);checks++;};
check(BELL_PAIRS.length===7&&BELL_PAIRS.map(p=>p.natural).join('')==='CDEFGAB','pairing changes never remove the seven agreed natural-center bells');
for(let octave=3;octave<=6;octave++)for(let column=0;column<7;column++){
  const bell=pairedBellAt(octave,column),base=(octave+1)*12;
  check(bell.centerMidi===base+[0,2,4,5,7,9,11][column]&&bell.sideMidi===base+[4,5,4,6,11,12,11][column],'C/D/G/A use the sketch; unpictured E/F/B keep their previous sides');
  check(bell.centerName===pitchLabel(bell.centerMidi)&&bell.sideName===pitchLabel(bell.sideMidi),'names are derived from actual pitches, not a row number');
  check(bell.sameSide===['E','B'].includes(bell.natural),'E and B side strikes still repeat their own center pitch');
}
for(let midi=48;midi<=96;midi++){
  const playable=[0,2,4,5,6,7,9,11].includes(midi%12),mapped=pairedPositionForMidi(midi);
  check(!!mapped===playable,'naturals and F-sharp are available; other accidentals are never folded or rounded');
  if(mapped)check(mapped.bell[`${mapped.zone}Midi`]===midi,'exact pitch-to-bell round trip');
  if(mapped&&midi<96&&midi%12!==6)check(mapped.zone==='center','all seven natural pitches have their own default center strike');
}
for(const [midi,label] of [[48,'c'],[60,'c¹'],[62,'d¹'],[64,'e¹'],[65,'f¹'],[67,'g¹'],[69,'a¹'],[71,'b¹'],[72,'c²'],[84,'c³'],[96,'c⁴'],[66,'♯f¹']])check(noteName(midi)===label,'small-letter group and superscript are consistent everywhere');
check(registerLabel(4)==='小字一组'&&registerLabel(6)==='小字三组','group labels use the same numbering as the notes');
check(frequency(pairedBellAt(4,5).centerMidi)===440,'renaming A4 to a¹ does not change concert pitch');
const lower=performanceLayout(820,200,{mobile:true,startOctave:4}),both=performanceLayout(820,282,{mobile:true,startOctave:4});
const nextC=performanceContact(lower,72);
check(nextC.bell.data.natural==='A'&&nextC.region==='right','top C remains playable on the last bell in a single group');
check(performanceContact(both,72).bell.data.natural==='C','ordinary shared C prefers a visible center');
for(const region of ['left','right']){
  const contact=performanceContact(both,72,region,'bell-4-a');
  check(contact.bell.data.id==='bell-4-a'&&contact.region===region,'recording the shared C preserves the exact lower bell and side');
}
const recorded={events:[{time:0,midi:72,region:'left',bellId:'bell-4-a'},{time:110,midi:61,region:'right'}]};
const prepared=scoreEvents(recorded,.6);
check(prepared[0].bellId==='bell-4-a'&&prepared[0].region==='left'&&prepared[1].midi===61&&prepared[1].time===110,'recording playback retains bell identity, old accidentals and unscaled timing');
check(WORKS_KEY==='ymqn:3d:v1:works','saved recordings remain under the existing key');
check(practiceBank([{midi:72,bellId:'bell-4-a',region:'left'}],2)===4,'replaying only a shared side C opens a bank containing its recorded bell');
check(practiceSections([{midi:60,time:0},{midi:72,time:100}],1).length===1,'C-to-next-C fits one real seven-bell row');
for(const natural of ['e','f','b'])check(practiceBank([{midi:natural==='e'?64:natural==='f'?66:71,bellId:`bell-4-${natural}`,region:'left'}],2)===4,'restored E/F/B recordings retain their owning register');
check(unsupportedPitches([{midi:61},{midi:66}]).join(',')==='61','F-sharp is supported without pretending C-sharp has a target');
assert.throws(()=>practiceSections([{midi:61,time:0}],2),RangeError,'truly unavailable notes cannot become impossible practice targets');
const context={window:{}};
for(const name of ['licensed-songs','zhuzhi-recording','songs'])vm.runInNewContext(await readFile(new URL(`data/${name}.js`,import.meta.url),'utf8'),context);
for(const id of ['zhuzhi-ci','zhuzhi-ci-recording']){
  const song=context.window.YMQNSongs.find(s=>s.id===id),before=JSON.stringify(song);
  check(!unsupportedPitches(song.events).length&&!unsupportedPitches(song.listenEvents).length,'both Zhu Zhi Ci versions remain fully representable');
  for(const rows of [1,2,3]){
    const events=scoreEvents(song,.72),parts=practiceSections(events,rows);
    check(parts.flatMap(p=>p.events).length===events.length&&parts.every(p=>rangeFits(p.events,{rows,low:p.low})),'every original theme or full-score event fits its actual practice bank');
    for(const part of parts){
      const layout=performanceLayout(1200,rows===3?634:rows===2?282:200,{choice:rows===3?'full':rows===1?'single':'auto',mobile:rows!==3,startOctave:part.low});
      for(const event of part.events)check(!!performanceContact(layout,event.midi),'every follow target has a real physical strike point');
    }
  }
  check(JSON.stringify(song)===before,'source score, uncertainty and timing are never rewritten');
}
const qing=context.window.YMQNSongs.find(s=>s.id==='licensed-qing-tian');
check(!unsupportedPitches(qing.events).length,'restored F/F-sharp bell makes the original Qing Tian melody playable again');
check(performanceContact(both,66)?.bell.data.natural==='F','Qing Tian F-sharp has a real F-bell side target, not a substituted note');
console.log(`${checks} paired-instrument, octave, recording and real-target checks passed`);
