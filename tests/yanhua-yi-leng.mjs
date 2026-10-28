import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {yanhuaYiLeng as song} from '../app/data/yanhua-yi-leng.mjs';
import {scoreMeasures,scoreLocation} from '../app/score-workspace.mjs';
import {measuresFor,phraseEvents,practiceBank,practiceHit} from '../app/practice-model.mjs';
import {unsupportedPitches} from '../app/paired-instrument.mjs';
import {setLocale,t,tr} from '../app/i18n.mjs';

const before=JSON.stringify(song),measures=scoreMeasures(song),practice=measuresFor(song);
assert.equal(song.scoreKey,'C');assert.equal(song.bpm,77);assert.deepEqual(song.timeSignature,[4,4]);
assert.deepEqual(song.sourceBars,{first:4,last:32});assert.equal(measures.length,29);
assert.deepEqual(measures.map(m=>m.notes.reduce((sum,n)=>sum+n.duration,0)),[2,...Array(28).fill(4)]);
assert.equal(song.durationMs,88831);assert.equal(song.events.length,154);
assert.deepEqual(unsupportedPitches(song.events),[]);
assert.equal(Math.min(...song.events.map(e=>e.midi)),62);assert.equal(Math.max(...song.events.map(e=>e.midi)),83);
assert.deepEqual(song.events.slice(0,10).map(e=>e.midi),[64,64,67,69,67,69,72,71,69,67]);
assert.deepEqual(song.events.slice(0,3).map(e=>e.beat),[.5,1,1.5]);
assert.equal(song.events.find(e=>e.beat===13.5).durationBeat,1,'Cross-bar tie continues the existing E');
assert.equal(song.events.some(e=>e.beat===14),false,'The tied continuation is not struck again');
assert.equal(song.events.find(e=>e.beat===14.5).durationBeat,1.5,'Same-bar tie keeps the full held D');
assert.equal(song.events.some(e=>e.beat===15),false);
for(const bar of measures){
  const play=practice[bar.index];
  assert.ok(play.notes.every(n=>Number.isInteger(n.midi)&&!n.tie));
  assert.ok(play.displayNotes.filter(n=>n.degree===0||n.tie).every(n=>n.playIndex===null));
  assert.equal(practiceBank(play.notes,2).fits,true,'All visible phrases fit two four-bell registers');
  const timed=phraseEvents(play.notes,77);
  timed.forEach((e,i)=>assert.ok(Math.abs(e.time-play.notes[i].offset*60000/77)<.001,'Phrase playback retains rests and original offsets'));
  let index=0;for(const n of play.notes)index=practiceHit({index,notes:play.notes,phase:'wait'},n.midi).index;
  assert.equal(index,play.notes.length);
}
for(const index of [20,28]){
  const notes=practice[index].notes;
  assert.deepEqual(notes.slice(0,3).map(n=>n.midi),[76,74,76]);
  assert.deepEqual(notes.slice(0,3).map(n=>n.duration),[.125,.125,1.75]);
  assert.equal(notes[2].notatedDuration,2,'The written half note stays visible despite ornament timing');
}
song.events.forEach((e,index)=>{
  const cursor=scoreLocation(song,index,measures);
  assert.ok(measures[cursor.bar].notes.some(n=>n.midi===e.midi&&n.beat===e.beat),'Every actual strike locates its original bar');
});
assert.equal(JSON.stringify(song),before,'Notation and practice never rewrite the source score');
setLocale('en');for(const field of ['title','description','scoreWarning'])assert.notEqual(t(song[field]),song[field]);
assert.equal(tr`休止 ${1} 拍`,'Rest for 1 beat');assert.equal(tr`延续前音 ${1} 拍`,'Continue the previous note for 1 beat');setLocale('zh');
const context={window:{}};
for(const file of ['licensed-songs.js','zhuzhi-recording.js','songs.js'])vm.runInNewContext(await readFile(new URL(`../app/data/${file}`,import.meta.url),'utf8'),context);
assert.equal(context.window.YMQNSongs.filter(s=>s.id.startsWith('zhuzhi-ci')).length,2);
assert.ok(context.window.YMQNSongs.some(s=>s.id==='licensed-qing-tian'));
console.log('Yan Hua Yi Leng: 29 pictured measures, 154 strikes, pickup/rest timing, ties, ornaments, bilingual copy and original library preserved.');
