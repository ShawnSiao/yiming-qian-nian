import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {scoreMeasures,scoreLocation,pitchNotation,workspaceSplit,clampSplitFraction} from '../app/score-workspace.mjs';
import {STRIKE_FEEDBACK_MS,malletFeedback} from '../app/strike-feedback.mjs';
import {performanceLayout,performanceLayoutChanged} from '../app/performance-layout.mjs';
import {validateTargets} from '../app/model.mjs';
let checks=0;const check=(v,label)=>{assert.ok(v,label);checks++;};
const context={window:{}};
for(const name of ['licensed-songs','zhuzhi-recording','songs'])vm.runInNewContext(await readFile(new URL(`../app/data/${name}.js`,import.meta.url),'utf8'),context);
for(const song of context.window.YMQNSongs){
  const before=JSON.stringify(song),measures=scoreMeasures(song);
  check(measures.length>0,'every library score has readable notation or honest event phrases');
  song.events.forEach((e,index)=>{
    const cursor=scoreLocation(song,index,measures),notes=measures[cursor.bar].notes;
    check(notes.some(n=>n.midi===e.midi&&Math.abs(n.beat-e.beat)<.001),'every practice event maps to its own bar and absolute pitch');
  });
  check(JSON.stringify(song)===before,'reading notation never rewrites source events or timing');
  if(song.jianpuBars)check(measures.length===song.jianpuBars.length,'retain all original bars');
}
const short=context.window.YMQNSongs.find(s=>s.id==='zhuzhi-ci'),full=context.window.YMQNSongs.find(s=>s.id==='zhuzhi-ci-recording');
check(scoreMeasures(short)[0].notes[0].midi===57,'short theme retains low A3');
check(scoreMeasures(full)[0].notes[0].midi===62,'F-key full draft retains low D4');
check(scoreMeasures(full).flatMap(m=>m.notes).filter(n=>n.uncertain).length>=54,'uncertainty remains visible on the full draft');
for(const key of ['C','F'])for(let midi=48;midi<=95;midi++){
  const n=pitchNotation(midi,key),rebuilt=(key==='F'?65:60)+[0,2,4,5,7,9,11][n.degree-1]+(n.accidental?1:0)+n.octave*12;
  check(rebuilt===midi,'notation does not fold, omit or retune chromatic pitches');
}
for(const width of [1240,1400,1496,1880,2008,2520])for(const fraction of [.56,.65,.72,.80,.86]){
  const split=workspaceSplit(width,fraction);
  check(Math.abs(split.stage+split.panel+16-width)<.001&&split.stage>=900&&split.panel>=300&&split.panel<=760,'wide splitter reserves a safe minimum instrument and reading width');
  const layout=performanceLayout(split.stage,640),targets=layout.bells.flatMap(b=>b.targets),bodies=layout.bells.map(b=>({id:b.data.id,x:b.x,y:b.y+b.height*.26,width:b.width,height:b.height*.7}));
  check(layout.bells.length===21&&!validateTargets(targets,bodies,split.stage,640,layout).length,'21 bells and all 44px strike entrances survive each desktop split');
  check(!performanceLayoutChanged(performanceLayout(split.stage+20,640),layout),'small splitter movement does not silently change the note bank');
}
check(clampSplitFraction(-1)===.56&&clampSplitFraction(2)===.86,'invalid drag fractions remain bounded');
for(const mobile of [true,false])for(const height of [48,90,180,300]){
  const initial=malletFeedback({height},0,mobile),previous=Math.min(112,Math.max(70,height*.76));
  check(initial.height>previous*1.25&&initial.headWidth>=31,'mallet is visibly larger even for a small phone bell');
  check(initial.alpha===1&&malletFeedback({height},60,mobile).alpha===1,'impact head has an immediate visible hold, no audio delay');
  check(malletFeedback({height},300,mobile).alpha>0,'fast-note feedback remains visible past 300ms');
  check(malletFeedback({height},STRIKE_FEEDBACK_MS,mobile).ringAlpha===0,'feedback ends instead of keeping a continuous animation loop');
}
const app=await readFile(new URL('../app/app.mjs',import.meta.url),'utf8'),css=await readFile(new URL('../app/experience.css',import.meta.url),'utf8');
check(['onPointerCancel:splitEnd','onLostPointerCapture:splitEnd','onKeyDown:splitKey','setPointerCapture'].every(s=>app.includes(s)),'split drag has cancellation, capture and keyboard alternatives');
check(css.includes('@media(min-width:1280px)')&&css.includes('.practice-footer'),'desktop scores remain responsive beside the existing phone footer');
console.log(`${checks} score workspace, split, notation and mallet checks passed`);
