import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import english from '../app/locales/en.mjs';
import {resolveLocale,setLocale,getLocale,t,tr,scoreFile,LANGUAGE_KEY} from '../app/i18n.mjs';
import {pitchLabel,pairedBellAt,BELL_PAIRS} from '../app/paired-instrument.mjs';
import {readWorks,saveWorks,WORKS_KEY} from '../app/session.mjs';
import {recordedWork,renameWork} from '../app/recording-model.mjs';
import {BELL_PARTS,BELL_OVERVIEW,STRUCTURE_SOURCES} from '../app/data/bell-structure.mjs';
import {performanceLayout,bellNoteTags} from '../app/performance-layout.mjs';

assert.equal(resolveLocale({languages:['de-DE','en-GB']}),'en');
assert.equal(resolveLocale({languages:['zh-TW','en']}),'zh');
assert.equal(resolveLocale({query:'en',saved:'zh',languages:['zh-CN']}),'en');
assert.equal(resolveLocale({saved:'zh',languages:['en-US']}),'zh');
assert.equal(resolveLocale({languages:['fr-FR']}),'en');
assert.equal(resolveLocale({query:'bad',saved:'bad'}),'en');
const saved=new Map([[WORKS_KEY,JSON.stringify([{id:'original',title:'My 曲名',events:[{time:0,midi:60}],durationMs:800}])]]);
globalThis.localStorage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)};
const original=readWorks(),record={events:[{time:0,midi:60}]};
for(const locale of ['en','zh','en']){
  setLocale(locale);
  assert.equal(getLocale(),locale);
  assert.deepEqual(readWorks(),original,'language changes preserve existing recordings verbatim');
  assert.equal(saved.get(LANGUAGE_KEY),locale);
  const work=recordedWork(record,0,1);
  assert.equal(work.title,locale==='en'?'My recording 01':'我的钟曲 01');
  assert.equal(pitchLabel(60),locale==='en'?'C4':'c¹');
  assert.equal(pitchLabel(66),locale==='en'?'F♯4':'♯f¹');
  assert.equal(t('第 12 小节'),locale==='en'?'Bar 12':'第 12 小节');
  assert.equal(t('第2乐句'),locale==='en'?'Phrase 2':'第2乐句');
  for(const low of [3,4,5])for(const [w,h,mobile,portrait] of [[296,338,true,true],[366,566,true,true],[820,273,true,false],[1396,1000,false,false]]){
    const layout=performanceLayout(w,h,{mobile,portrait,startOctave:low,noteStyle:'classic'});
    assert.equal(layout.bells.length,layout.rows*7);
    for(const bell of layout.bells)for(const tag of bellNoteTags(layout,bell)){
      assert.equal(tag.text,pitchLabel(bell.data[tag.region==='center'?'centerMidi':'sideMidi']));
      assert.ok(tag.fontSize>=12);
      if(locale==='en')assert.match(tag.text,/^[A-G]♯?\d$/);
    }
  }
  for(let col=0;col<7;col++){
    const bell=pairedBellAt(4,col);
    assert.equal(bell.centerMidi,60+BELL_PAIRS[col].center);
    assert.equal(bell.sideMidi,60+BELL_PAIRS[col].side);
  }
}
assert.equal(tr`${1}拍`,'1 beat');
assert.equal(tr`${2}拍`,'2 beats');
assert.equal(scoreFile('html','./scores/zhuzhi-ci-recording.html'),'./scores/zhuzhi-ci-recording.en.html');
assert.equal(scoreFile('midi','./scores/zhuzhi-ci-recording.mid'),'./scores/zhuzhi-ci-recording.mid');
const renamed=renameWork(original,'original',' Evening 钟曲 ');
assert.equal(renamed[0].title,'Evening 钟曲');assert.deepEqual(renamed[0].events,original[0].events);
assert.ok(saveWorks(renamed));assert.deepEqual(readWorks(),renamed);
localStorage.getItem=()=>{throw new Error('Storage blocked');};localStorage.setItem=()=>{throw new Error('Storage blocked');};
assert.deepEqual(readWorks(),[]);assert.equal(saveWorks(original),false);assert.doesNotThrow(()=>setLocale('en'));
delete globalThis.localStorage;
for(const [key,value] of Object.entries(english)){
  assert.equal(typeof value,'string');assert.ok(value.trim());
  assert.deepEqual([...key.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort(),[...value.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort(),`Placeholders match: ${key}`);
}
for(const item of [BELL_OVERVIEW,...BELL_PARTS])for(const field of ['name','reading','text','note'])if(item[field])assert.ok(english[item[field]],`Structure ${item.id}.${field} has an English translation`);
for(const source of Object.values(STRUCTURE_SOURCES))assert.ok(english[source.name]);
const context={window:{}};
for(const name of ['licensed-songs','zhuzhi-recording','songs'])vm.runInNewContext(await readFile(new URL(`../app/data/${name}.js`,import.meta.url),'utf8'),context);
for(const song of context.window.YMQNSongs){
  for(const field of ['title','description','category','scoreWarning'])if(song[field])assert.ok(english[song[field]],`${song.id}.${field} is translated`);
  for(const [type,path] of Object.entries(song.scoreFiles||{}))assert.ok((await readFile(new URL(`../app/${scoreFile(type,path)}`,import.meta.url))).length);
}
console.log(`Bilingual UI, ${Object.keys(english).length} message placeholders, pitches, recording continuity and localized score checks passed.`);
