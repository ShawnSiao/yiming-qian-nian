import assert from 'node:assert/strict';
import {BELL_PAIRS,pairedBellAt,pairedPositionForMidi,isPairedPitch,pitchFitsBank} from '../app/paired-instrument.mjs';
import {performanceLayout,performanceContact} from '../app/performance-layout.mjs';
import {practiceBank} from '../app/practice-model.mjs';
import {scoreEvents} from '../app/session.mjs';

assert.deepEqual(BELL_PAIRS.map(p=>p.side),[4,5,7,6,11,12,14]);
for(let octave=3;octave<=6;octave++)for(let column=0;column<7;column++){
  const bell=pairedBellAt(octave,column);assert.notEqual(bell.centerMidi,bell.sideMidi);
  assert.equal(pitchFitsBank(bell.centerMidi,octave,1),true);assert.equal(pitchFitsBank(bell.sideMidi,octave,1),true);
  for(const midi of [bell.centerMidi,bell.sideMidi]){
    assert.equal(isPairedPitch(midi),true);const contact=pairedPositionForMidi(midi);assert.ok(contact);
    assert.equal(contact.bell[contact.zone==='center'?'centerMidi':'sideMidi'],midi);
  }
}
assert.equal(isPairedPitch(98),true);assert.equal(isPairedPitch(97),false);assert.equal(isPairedPitch(99),false);
assert.equal(pairedPositionForMidi(98).bell.id,'bell-6-b');assert.equal(pairedPositionForMidi(98).zone,'side');
assert.equal(practiceBank([{midi:98}],1).low,6);assert.equal(practiceBank([{midi:98}],1).fits,true);
assert.equal(pitchFitsBank(66,4,1),true,'F-sharp remains available for Qing Tian');
const layout=performanceLayout(1100,620,{startOctave:4});
const old={bpm:60,events:[{midi:64,time:0,region:'left',bellId:'bell-4-e'},{midi:71,time:800,region:'right',bellId:'bell-4-b'}]};
const before=JSON.stringify(old);
for(const event of scoreEvents(old)){
  const contact=performanceContact(layout,event.midi,event.region,event.bellId);assert.ok(contact);
  assert.equal(contact.region,'center');assert.equal(contact.bell.data.centerMidi,event.midi);
}
assert.equal(JSON.stringify(old),before,'Historical notes and stored events are never rewritten');
console.log('Paired pitches: seven distinct pairs, D7, real bank ownership, F-sharp and legacy MIDI replay passed.');
