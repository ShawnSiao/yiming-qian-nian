import assert from 'node:assert/strict';
import {BELL_PAIRS,pairedBellAt,pairedPositionForMidi,isPairedPitch,pitchFitsBank,pitchLabel,unsupportedPitches} from '../app/paired-instrument.mjs';
import {performanceLayout,performanceContact} from '../app/performance-layout.mjs';
import {practiceBank} from '../app/practice-model.mjs';
import {scoreEvents} from '../app/session.mjs';

assert.deepEqual(BELL_PAIRS.map(p=>[p.center,p.side]),[[0,4],[2,5],[7,11],[9,12]]);
for(let octave=3;octave<=6;octave++)for(let column=0;column<4;column++){
  const bell=pairedBellAt(octave,column);assert.notEqual(bell.centerMidi,bell.sideMidi);
  assert.equal(pitchFitsBank(bell.centerMidi,octave,1),true);assert.equal(pitchFitsBank(bell.sideMidi,octave,1),true);
  for(const midi of [bell.centerMidi,bell.sideMidi]){
    assert.equal(isPairedPitch(midi),true);const contact=pairedPositionForMidi(midi);assert.ok(contact);
    assert.equal(contact.bell[contact.zone==='center'?'centerMidi':'sideMidi'],midi);
  }
}
assert.equal(isPairedPitch(96),true);assert.equal(isPairedPitch(97),false);assert.equal(isPairedPitch(98),false);
assert.equal(pairedPositionForMidi(96).bell.id,'bell-6-a');assert.equal(pairedPositionForMidi(96).zone,'side');
assert.equal(practiceBank([{midi:96}],1).low,6);assert.equal(practiceBank([{midi:96}],1).fits,true);
assert.equal(pitchFitsBank(66,4,1),false,'Four natural-tone pairs do not invent an F-sharp point');
assert.deepEqual(unsupportedPitches([{midi:66},{midi:98},{midi:66},{midi:96}]),[66,98]);
for(const [midi,label] of [[60,'c¹'],[64,'e¹'],[72,'c²'],[76,'e²'],[84,'c³'],[88,'e³']])assert.equal(pitchLabel(midi),label);
const naturalOctave=new Set(BELL_PAIRS.flatMap(p=>[p.center,p.side]));
assert.deepEqual([...naturalOctave].sort((a,b)=>a-b),[0,2,4,5,7,9,11,12]);
const threeRegisters=new Set([4,5,6].flatMap(o=>BELL_PAIRS.flatMap(p=>[(o+1)*12+p.center,(o+1)*12+p.side])));
assert.equal(threeRegisters.size,22);assert.equal(Math.max(...threeRegisters),96);
const layout=performanceLayout(1100,620,{startOctave:4});
const old={bpm:60,events:[{midi:64,time:0,region:'left',bellId:'bell-4-e'},{midi:71,time:800,region:'right',bellId:'bell-4-b'}]};
const before=JSON.stringify(old);
for(const event of scoreEvents(old)){
  const contact=performanceContact(layout,event.midi,event.region,event.bellId);assert.ok(contact);
  assert.equal(contact.bell.data[contact.region==='center'?'centerMidi':'sideMidi'],event.midi);
}
assert.equal(performanceContact(layout,66,'right','bell-4-f'),null,'Old F-sharp replay must use audio fallback, never a different visible note');
assert.equal(performanceContact(layout,98,'right','bell-6-b'),null,'Old D7 remains audio-only instead of being folded down');
assert.equal(JSON.stringify(old),before,'Historical notes and stored events are never rewritten');
console.log('Four-bell pairs, c¹/e¹ labels, 22 natural pitches, missing accidentals and unchanged legacy MIDI replay passed.');
