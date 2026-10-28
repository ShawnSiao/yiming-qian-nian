import assert from 'node:assert/strict';
import {displayPitch} from '../app/pitch-display.mjs';
import {setLocale} from '../app/i18n.mjs';
import {pitchLabel} from '../app/paired-instrument.mjs';
import {performanceLayout,bellNoteTags,findNoteTagHit,performanceLayoutChanged} from '../app/performance-layout.mjs';

for(const locale of ['zh','en']){
  setLocale(locale);
  for(let midi=48;midi<=96;midi++)for(const key of ['C','F']){
    assert.equal(displayPitch(midi,'pitch',key).text,pitchLabel(midi));
    const n=displayPitch(midi,'numbered',key),digit=Number(n.text.slice(-1));
    const restored=(key==='F'?65:60)+[0,2,4,5,7,9,11][digit-1]+(n.text.startsWith('♯')?1:0)+n.octave*12;
    assert.equal(restored,midi,'Changing notation never transposes or folds a pitch');
  }
}
setLocale('zh');
for(const [midi,text,octave] of [[60,'1',0],[64,'3',0],[62,'2',0],[65,'4',0],[67,'5',0],[71,'7',0],[69,'6',0],[72,'1',1],[84,'1',2],[96,'1',3],[57,'6',-1]]){
  const actual=displayPitch(midi,'numbered','C');assert.equal(actual.text,text);assert.equal(actual.octave,octave);
}
assert.equal(displayPitch(60,'numbered','C').label,'1');
assert.equal(displayPitch(72,'numbered','C').label,'1\u0307');
assert.equal(displayPitch(57,'numbered','C').label,'6\u0323');
assert.equal(displayPitch(65,'numbered','F').text,'1');
assert.equal(displayPitch(60,'numbered','F').octave,-1);
assert.equal(displayPitch(71,'numbered','F').text,'♯4','F-key B stays B, written as raised fourth');
assert.equal(displayPitch(-1,'numbered').text,'—');
for(const [width,height,portrait] of [[276,270,true],[296,338,true],[366,566,true],[544,203,false],[820,273,false],[1396,640,false]]){
  const options={mobile:width<900,portrait},original=performanceLayout(width,height,options);
  for(const key of ['C','F']){
    const numbered=performanceLayout(width,height,{...options,notation:'numbered',notationKey:key});
    assert.equal(performanceLayoutChanged(original,numbered),false);
    assert.deepEqual(numbered.bells,original.bells,'Notation keeps bodies, MIDI, strike targets and contact positions unchanged');
    for(const bell of numbered.bells)for(const tag of bellNoteTags(numbered,bell)){
      const midi=bell.data[tag.region==='center'?'centerMidi':'sideMidi'],n=displayPitch(midi,'numbered',key);
      assert.equal(tag.text,n.text);assert.equal(tag.octave,n.octave);
      assert.ok(tag.x>=0&&tag.y>=0&&tag.x+tag.width<=width&&tag.y+tag.height<=height,'Octave dots stay inside the instrument area');
      const hit=findNoteTagHit(numbered,tag.x+tag.width/2,tag.y+tag.height/2);
      assert.equal(hit?.bell,bell);assert.equal(hit?.region,tag.region,'Numbered plaques retain their own strike');
    }
  }
}
console.log('Numbered notation: C/F keys, octave dots, bilingual names, unchanged MIDI and mobile plaque hit mapping passed.');
