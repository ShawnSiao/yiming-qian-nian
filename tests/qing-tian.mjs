import assert from 'node:assert/strict';
import {qingTian as song} from '../app/data/qing-tian.mjs';
import {scoreMeasures,pitchNotation} from '../app/score-workspace.mjs';
import {measuresFor,phraseEvents,practiceHit} from '../app/practice-model.mjs';
import {unsupportedPitches} from '../app/paired-instrument.mjs';
import {setLocale,t} from '../app/i18n.mjs';

const before=JSON.stringify(song),bars=scoreMeasures(song),practice=measuresFor(song);
assert.equal(song.id,'licensed-qing-tian','Retain the existing library identity');
assert.equal(song.scoreKey,'G');assert.equal(song.bpm,67);assert.deepEqual(song.timeSignature,[4,4]);
assert.equal(song.sourceSheets.length,2);assert.equal(bars.length,69);assert.equal(song.events.length,503);
assert.equal(song.durationMs,246493);assert.equal(song.playbackEndBeat,275.25);
assert.deepEqual(bars.map(b=>b.notes.reduce((sum,n)=>sum+n.duration,0)),Array(69).fill(4));
assert.deepEqual(song.events.slice(0,9).map(n=>n.midi),[64,67,74,67,60,62,64,74,67],'Intro retains its printed low dots, in G');
assert.deepEqual(bars[1].notes.map(n=>n.midi),[55,62,74,67,55,74,54,74],'Two lower dots mean F♯3, not a folded F♯4');
assert.deepEqual(unsupportedPitches(song.events),[54,66,73,75,78],'No unsupported pitch is silently retuned');
assert.deepEqual(bars[28].notes.map(n=>n.midi),[71,73,75,71,73,75,78],'Printed ♯4 and ♯5 carry to the unmarked notes in this bar');
assert.equal(bars[29].notes[0].midi,81);assert.equal(bars[30].notes[5].midi,72,'The next bar resets C♯ to C');
for(const index of [28,36,56,64])assert.deepEqual(bars[index].notes.map(n=>n.midi),[71,73,75,71,73,75,78]);
assert.equal(song.events.find(e=>e.beat===75.875).durationBeat,2.125,'The cross-bar B tie follows its grace note and stays one attack');
assert.equal(song.events.some(e=>e.beat===76),false);
for(const index of [41,42])assert.equal(practice[index].notes.length,0,'Full silent bars are kept');
assert.equal(bars[68].notes.filter(n=>n.degree==='X').length,3);
assert.ok(bars[68].notes.filter(n=>n.degree==='X').every(n=>n.midi===null));
assert.equal(song.rhythmCoda.length,5);assert.ok(song.events.every(n=>n.beat<song.playbackEndBeat));
assert.equal(song.events.at(-1).midi,67);assert.equal(song.events.at(-1).durationBeat,2.5);
for(const bar of bars){
  for(const n of bar.notes){
    assert.ok(n.duration>0&&n.offset>=0&&n.offset+n.duration<=4,'Ornaments borrow time inside the original bar');
  }
  const p=practice[bar.index],timed=phraseEvents(p.notes,song.bpm);
  timed.forEach((e,i)=>assert.ok(Math.abs(e.time-p.notes[i].offset*60000/67)<.001));
  if(!p.notes.length||unsupportedPitches(p.notes).length)continue;
  let index=0;for(const n of p.notes)index=practiceHit({index,notes:p.notes,phase:'wait'},n.midi).index;
  assert.equal(index,p.notes.length,'Available phrases remain independently practicable');
}
const accidentalProbe=scoreMeasures({scoreKey:'G',jianpuBars:[
  [{degree:4,accidental:'♯',duration:1},{degree:4,duration:1},{degree:4,accidental:'♮',duration:1},{degree:4,duration:1}],
  [{degree:4,duration:1},{degree:7,duration:1},{degree:0,duration:1},{degree:'X',duration:1}],
]});
assert.deepEqual(accidentalProbe.flatMap(b=>b.notes.map(n=>n.midi)),[73,73,72,72,72,78,null,null]);
assert.deepEqual(pitchNotation(78,'G'),{degree:7,accidental:'',octave:0});
setLocale('en');for(const field of ['title','description','scoreWarning','scoreCredit'])assert.notEqual(t(song[field]),song[field]);setLocale('zh');
assert.equal(JSON.stringify(song),before,'Notation, audition and practice preserve the source');
console.log('Qing Tian: both supplied pages, 69 bars, 503 attacks, G/67 BPM, original accidentals, ties, rests, X boundary and available-phrase practice passed.');
