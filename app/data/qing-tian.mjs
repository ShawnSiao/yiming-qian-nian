import {scoreMeasures} from '../score-workspace.mjs';

// User-supplied two-page score: 1=G, 4/4, quarter note = 67.
// Numbers are scale degrees, octave -1 / -2 are the dots BELOW the print.
// Only equal-pitch ties suppress an attack; different-pitch slurs do not.
const n=(degree,duration=.5,octave=0,extra={})=>({degree,duration,octave,...extra});
const r=duration=>n(0,duration);
const tie={tie:true};
const g=(degree,extra={})=>({graceNotes:[{degree}],...extra});
const sharp={accidental:'♯'};

const introA=[n(6,.5,-1),n(1),n(5),n(1),n(4,.5,-1),n(5,.25,-1),n(6,.25,-1),n(5),n(1)];
const introB=[n(1,.5,-1),n(5,.5,-1),n(5),n(1),n(1,.5,-1),n(5),n(7,.5,-2),n(5)];
const introC=[n(6,.5,-1),n(1),n(5),n(6,.5,-1),n(4,.5,-1),n(5,.25,-1),n(6,.25,-1),n(5),n(1)];
const introD=[n(1,.5,-1),n(5,.5,-1),n(5),n(1),n(1,.5,-1),n(5),n(7,.25,-2),n(1,.25,-1),n(5)];
const verseA=[r(.5),n(5),n(5),n(1),n(1,1),n(2),n(3)];
const fastA=[n(1,.25),n(1,.25),n(1,.25),n(1,.25),n(7,.25,-1),n(1),n(1,.25),n(1,.25,0,tie),n(1,.25),n(1,.25),n(1,.25),n(7,.25,-1),n(1),n(1,.25)];
const fastB=[n(1,.25,0,tie),n(1,.25),n(1,.25),n(1,.25),n(7,.25,-1),n(1),n(1,.25),n(1,.25,0,tie),n(1,.25),n(1,.25),n(1,.25),n(5,.25),n(5),n(5,.25)];
const fastC=[r(.25),n(5,.25),n(5,.25),n(5,.25),n(5,.25),n(5),n(5,.25),n(5,.25,0,tie),n(5,.25),n(5,.25),n(5,.25),n(5,.25),n(4,.25),n(3,.25),n(3,.25,0,g(2))];
const fastD=[n(3,2,0,tie),r(1),n(1,.25),n(1,.25),n(1,.25),n(1,.25)];
const verseB=[n(6,.5,-1),n(7,.5,-1),n(1),n(5),n(4),n(3),n(1),n(1)];
const verseC=[n(1,1,0,tie),r(1),n(1,.25),n(1,.25),n(1,.25),n(1,.25),n(3,.5,0,g(2)),n(1)];
const verseD=[n(6,.5,-1),n(7,.5,-1),n(1),n(5),n(4),n(3),n(1),n(2,.5,0,g(1))];
const held=[n(2,2,0,tie),r(1),r(1)];
const chorusA=[n(3,.5,0,g(2)),n(2),n(4,.5,0,g(3)),n(3,1),n(1),n(5,.5,0,g(3)),n(7)];
const chorusB=[n(1,.5,1),n(7),n(1,.5,0,g(5)),n(1,1),n(1),n(6,.5,0,g(5)),n(6)];
const chorusC=[r(.5),n(6),n(5),n(5,1),n(5),n(4),n(3)];
const chorusD=[n(2),n(3),n(4),n(3,.5,0,g(2)),n(3,2,0,tie)];
// The repeated, unmarked 4 and 5 inherit the printed sharps in this bar.
const chorusE=[n(3),n(4,.5,0,sharp),n(5,.5,0,sharp),n(3,1),n(4),n(5),n(7)];
const chorusF=[n(2,.5,1),n(7),n(1,.5,1),n(1,1.5,1),r(.5),n(1,.5,1)];
const chorusG=[n(1,.5,1),n(5),n(5),n(6),n(5,.25),n(4,.25),n(4),n(2),n(3)];
const chorusH=[n(4),n(5),n(6),n(1),n(6,.75),n(7,.25),n(7,1)];
const endingA=[n(1,.5,1),n(5),n(5),n(6),n(5),n(4),n(6,.5,-1),n(7,.5,-1)];
const endingB=[n(1),n(2),n(3),n(2,1.5),n(3,.5,0,g(2)),n(1)];
const bars=[
  // Page 1, lines 1–2: eight written instrumental bars, no inferred repeats.
  introA,introB,introC,introD,introA,introB,introC,introD,
  // Page 1, line 3 (bars 9–11).
  verseA,
  [r(.5),n(5),n(5),n(1),n(1),n(2,.25),n(3,.25),n(2,.25),n(1,.25),n(5,.5,-1)],
  verseA,
  // Line 4 (12–13).
  [r(.5),n(3,1,0,g(2)),n(2,.25),n(3,.25),n(4,.25),n(3,.25),n(2,.25),n(4,.25),n(3,.25),n(2,.25),n(1)],
  [n(5,.5,-1),n(1),n(1),n(3),n(4),n(3),n(2,.25),n(1),n(2,.25)],
  // Line 5 (14–16).
  [n(3),n(3),n(3),n(3),n(2,.25),n(3,.25),n(2),n(1,1)],
  [n(5,.5,-1),n(1),n(2),n(3),n(4,.5,0,g(3)),n(3),n(2,.25),n(1),n(2,.25)],
  [n(3,.5,0,g(2)),n(3),n(3,.5,0,g(2)),n(3),n(2,.25),n(3,.25),n(2),n(1,.75),n(7,.25,-1)],
  // Lines 6–8 (17–23).
  fastA,fastB,fastC,fastD,verseB,verseC,verseD,
  // Lines 9–12 (24–38).
  held,chorusA,chorusB,chorusC,chorusD,chorusE,chorusF,chorusG,
  chorusH,chorusA,chorusB,chorusC,chorusD,chorusE,chorusF,
  // Page 2, line 1 (39–43). The following rest bars are intentional.
  endingA,endingB,[n(1,2,0,tie),r(1),r(1)],
  [r(1),r(1),r(1),r(1)],[r(1),r(1),r(1),r(1)],
  // Lines 2–5 (44–54).
  [r(1),r(1),r(1),r(.75),n(7,.25,-1)],
  fastA,fastB,fastC,fastD,verseB,verseC,verseD,held,chorusA,chorusB,
  // Lines 6–9 (55–69). Bar 62 is the higher second-chorus variant.
  chorusC,chorusD,chorusE,chorusF,chorusG,chorusH,chorusA,
  [n(1,.5,1),n(7),n(2,1,1),n(1,1,1,{ornament:'vibrato'}),n(6,.5,0,g(5)),n(6)],
  chorusC,chorusD,chorusE,chorusF,endingA,endingB,
  [n(1,2,0,tie),r(1),r(.25),n('X',.25),n('X',.25),n('X',.25)],
];

export const qingTian={
  // Keep the existing identity; replace its earlier event sketch in the app.
  id:'licensed-qing-tian',title:'晴天',category:'流行',bpm:67,
  mode:'chromatic',difficulty:3,scoreKey:'G',timeSignature:[4,4],
  rightsStatus:'用户提供谱图；公开分发授权未核验',
  scoreCredit:'周杰伦词曲 · 孙世彦制谱',
  description:'按两页简谱录入，1=G，4/4，67 BPM。含前奏、69 小节旋律谱及末段 X 节奏参考；试听保留原音高。',
  scoreWarning:'四钟音组未设置 F♯、C♯、D♯ 击点：可听原音，含这些音的小节暂不能跟敲。末段 X 无固定音高，仅展示节奏参考，旋律试听在 X 段前结束。',
  sourceSheets:['codex-clipboard-7d80fb02-5b32-48c9-974e-610e1bcb9ac9.png','codex-clipboard-e0439187-ecd6-4945-ac5b-9cbeb26290e4.png'],
  jianpuBars:bars,playbackEndBeat:275.25,
  // Literal groups from the remaining X lines; no guessed pitches or meters.
  rhythmCoda:[
    'X X　X X 0　X X X X　0 X X X　|　0 X X X　0 X X X　X X X X　0 X X',
    'X X　X X X X　X X X X　0 X X　|　X X X X　0 X X X　X X X X　X X X',
    'X X X　X X X　X X X X　0 X X X',
    '0 X X X　0 X X X　X X X X　0 X X X　|　X X　X X 0　X X X X　0 X X X',
    'X X X X　X X X X　X X X X　0',
  ],
};

const events=[];
for(const measure of scoreMeasures(qingTian))for(const note of measure.notes){
  if(!Number.isInteger(note.midi))continue;
  if(note.tie){
    const previous=events.at(-1);
    if(previous?.midi!==note.midi)throw new Error('Invalid tied pitch in Qing Tian score');
    previous.durationBeat+=note.duration;
  }else events.push({beat:note.beat,midi:note.midi,durationBeat:note.duration,velocity:note.grace ? .65 : .82});
}
qingTian.events=events;
qingTian.durationMs=Math.round(qingTian.playbackEndBeat*60000/qingTian.bpm);
