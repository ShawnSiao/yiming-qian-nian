import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {measuresFor,practiceBank,practiceHit,phraseEvents} from '../app/practice-model.mjs';

const context={window:{}};
for(const file of ['licensed-songs.js','zhuzhi-recording.js','songs.js'])vm.runInNewContext(fs.readFileSync(new URL(`../app/data/${file}`,import.meta.url),'utf8'),context);
const songs=context.window.YMQNSongs,short=songs.find(s=>s.id==='zhuzhi-ci'),full=songs.find(s=>s.id==='zhuzhi-ci-recording');
const measures=measuresFor(short),notes=measures[0].notes;
assert.deepEqual(Array.from(notes,n=>n.midi),[57,62,62,60,62]);
assert.equal(measures.length,8);assert.equal(full.durationMs,153000);assert.ok(full.transcriptionStatus);
assert.equal(practiceBank(notes,2).fits,true);
assert.equal(practiceBank(notes,1).fits,false,'A narrow single register must request an explicit bank change.');
assert.equal(practiceBank([{midi:62}],1).low,4,'The next-bank hint must name the register containing the actual pitch.');
assert.equal(practiceBank([{midi:61}],2).fits,false,'Unsupported pitches must never be quantized into another note.');
assert.equal(practiceHit({index:0,notes,phase:'wait'},60).index,0,'A wrong hit must not advance.');
assert.equal(practiceHit({index:0,notes,phase:'wait',paused:true},57).index,0,'A paused exercise must not advance.');
assert.equal(practiceHit({index:0,notes,phase:'listen'},57).index,0,'An audition must not complete a practice step.');
let index=0;for(const midi of [57,62,62,60,62])index=practiceHit({index,notes,phase:'wait'},midi).index;
assert.equal(index,5,'Repeated equal pitches still require separate actions.');
assert.equal(practiceHit({index:4,notes,phase:'wait'},62).done,true);
assert.deepEqual(Array.from(phraseEvents(notes,60),e=>e.time),[0,1000,2000,3000,3500]);
for(const name of ['licensed-songs.js','zhuzhi-recording.js','songs.js']){
  const hash=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
  assert.equal(hash(new URL(`../app/data/${name}`,import.meta.url)),hash(new URL(`../versions/r15/data/${name}`,import.meta.url)),'Source scores stay byte-identical.');
}
console.log('Practice checks passed: original scores, supported pitches, wrong/correct/repeated hits, pause, audition separation, and timing.');
