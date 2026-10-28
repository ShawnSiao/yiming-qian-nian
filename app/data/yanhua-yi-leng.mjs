import {scoreMeasures} from '../score-workspace.mjs';

// Transcribed from the user-provided 1000014919.jpg, not from a recording.
// Source bar 4's vocal pickup, then bars 5–32. The instrumental introduction
// contains A2 / F-sharp3 outside the four-bell instrument and is not included.
// No repeat ending or final cadence is visible: play the main staff once.
const n=(degree,duration=.5,octave=0,extra={})=>({degree,duration,octave,...extra});
const r=duration=>n(0,duration);
const tie={tie:true};
const turn={graceNotes:[{degree:3,octave:1},{degree:2,octave:1}]};
const bars=[
  // Source 4: two-beat pickup after the parenthesized introduction.
  [r(.5),n(3),n(3),n(5)],
  // Source 5–6.
  [n(6),n(5),n(6),n(1,.5,1),n(7),n(6),n(5,1)],
  [n(6,.25),n(5,.25),n(3,1.5),r(.5),n(3),n(3),n(5)],
  // Source 7–11.
  [n(6),n(5),n(6),n(1,.5,1),n(7),n(6),n(6),n(3)],
  [n(3,.5,0,tie),n(2),n(2,1,0,tie),r(.5),n(6),n(2,1,1)],
  [n(6),n(2,1.5,1),r(.5),n(6),n(2,.75,1),n(6,.25)],
  [n(7,1),n(3,1),r(.5),n(2),n(3),n(2)],
  [n(5,1),r(.5),n(2),n(5),n(6),n(7),n(1,.5,1)],
  // Source 12–16.
  [n(7,.25),n(6,.25),n(7,1.5),r(.5),n(3),n(3),n(5)],
  [n(6),n(5),n(6),n(1,.5,1),n(7),n(6),n(5),n(6)],
  [n(6,.5,0,tie),n(3,1.5),r(.5),n(3),n(3),n(5)],
  [n(6),n(5),n(6),n(1,.5,1),n(7),n(6),n(6),n(5)],
  [n(5,.5,0,tie),n(3,1.5,1),r(.5),n(6),n(2,.75,1),n(6,.25)],
  // Source 17–21.
  [n(2,2,1),r(.5),n(3,.5,1),n(7,.75),n(6,.25)],
  [n(7,.25),n(1,.25,1),n(7),n(7,2,0,tie),n(6),n(2,.5,1)],
  [n(7),n(3),n(6),n(2,.5,1),n(7),n(3),n(6,.75),n(5,.25)],
  [n(6,3),n(5,.5,1),n(3,.5,1)],
  [n(2,1,1),r(.5),n(2,.5,1),n(2,.5,1),n(3,.5,1),n(1,.5,1),n(2,.5,1)],
  // Source 22–27. The two small 3–2 notes are on-beat ornaments; their
  // playback borrows a quarter-beat from the following written half note.
  [n(3,2,1),r(1),n(5,.5,1),n(3,.5,1)],
  [n(2,1,1),r(.5),n(2,.5,1),n(2,.5,1),n(5),n(3,.75,1),n(4,.25,1)],
  [n(3,2,1,turn),r(1),n(3,.5,1),n(3,.5,1)],
  [n(7,1.5,1),n(3,.25,1),n(2,.25,1),n(2,1,1),n(1,.5,1),n(7)],
  [n(1,.5,1),n(2,.5,1),n(3,.5,1),n(6,.5,1),n(6,1,1,tie),n(6),n(1,.5,1)],
  [n(3,.5,1),n(2,.5,1),n(6),n(1,.5,1),n(7,1),n(5,1)],
  // Source 28–32, the last fully legible line in the supplied image.
  [n(6,3),n(5,.5,1),n(3,.5,1)],
  [n(2,1,1),r(.5),n(2,.5,1),n(2,.5,1),n(3,.5,1),n(1,.5,1),n(2,.5,1)],
  [n(3,2,1),r(1),n(5,.5,1),n(3,.5,1)],
  [n(2,1,1),r(.5),n(2,.5,1),n(2,.5,1),n(5),n(3,.75,1),n(4,.25,1)],
  [n(3,2,1,turn),r(1),n(3,.5,1),n(3,.5,1)],
];

export const yanhuaYiLeng={
  id:'yanhua-yi-leng',title:'烟花易冷 · 谱图选段',category:'流行',bpm:77,
  mode:'chromatic',difficulty:3,scoreKey:'C',timeSignature:[4,4],pickupBeats:2,
  rightsStatus:'用户提供谱图；公开分发授权未核验',
  scoreCredit:'周杰伦作曲 · 方文山作词 · 金声声乐制谱',
  description:'1=C，4/4，77 BPM。含 2 拍弱起与 28 小节正文；前奏和图片外结尾未纳入。',
  scoreWarning:'正文选段，未含前奏。谱图未显示反复终点与完整结尾，本版按主谱线演奏一遍。',
  sourceSheet:'1000014919.jpg',sourceBars:{first:4,last:32},jianpuBars:bars,
};

const events=[];
for(const measure of scoreMeasures(yanhuaYiLeng))for(const note of measure.notes){
  if(!Number.isInteger(note.midi))continue;
  if(note.tie){
    const previous=events.at(-1);
    if(previous?.midi!==note.midi)throw new Error('Invalid tied pitch in supplied sheet');
    previous.durationBeat+=note.duration;
  }else events.push({beat:note.beat,midi:note.midi,durationBeat:note.duration,velocity:note.grace ? .65 : .82});
}
yanhuaYiLeng.events=events;
yanhuaYiLeng.durationMs=Math.round((2+(bars.length-1)*4)*60000/yanhuaYiLeng.bpm);
