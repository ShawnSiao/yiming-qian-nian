// Keep all seven natural centers. The sketch changes C/D/G/A side pitches;
// unpictured E/F/B retain their previous E/E, F/F-sharp and B/B pairings.
// MIDI stays absolute; labels use small-letter groups.
export const BELL_PAIRS = Object.freeze([
  {natural:'C',center:0,side:4,size:1},
  {natural:'D',center:2,side:5,size:.91},
  {natural:'E',center:4,side:4,size:.83},
  {natural:'F',center:5,side:6,size:.76},
  {natural:'G',center:7,side:11,size:.69},
  {natural:'A',center:9,side:12,size:.63},
  {natural:'B',center:11,side:11,size:.57},
].map(Object.freeze));
const LETTERS=['c','c','d','d','e','f','f','g','g','a','a','b'];
const SHARPS=new Set([1,3,6,8,10]);
const PAIRED_PITCHES=new Set(BELL_PAIRS.flatMap(p=>[p.center%12,p.side%12]));
const superscript=n=>String(n).replace(/\d/g,d=>'⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]);
const subscript=n=>String(n).replace(/\d/g,d=>'₀₁₂₃₄₅₆₇₈₉'[Number(d)]);
export function pitchLabel(midi){
  if(!Number.isInteger(midi)||midi<0||midi>127)return '—';
  const pitch=midi%12,octave=Math.floor(midi/12)-1,letter=LETTERS[pitch];
  return (SHARPS.has(pitch)?'♯':'')+(octave>=3?letter:letter.toUpperCase())+
    (octave>=4?superscript(octave-3):octave<2?subscript(2-octave):'');
}
export function registerLabel(octave){return octave===3?'小字组':`小字${['','','','','一','二','三'][octave]||octave-3}组`;}
export function registerMark(octave){return octave===3?'小':String(octave-3);}
export function isPairedPitch(midi){return Number.isInteger(midi)&&midi>=48&&midi<=96&&PAIRED_PITCHES.has(midi%12);}
export function pairedBellAt(octave,column){
  const pair=BELL_PAIRS[column];
  if(!Number.isInteger(octave)||octave<3||octave>6||!pair)throw new RangeError('Unsupported paired bell');
  const base=(octave+1)*12,centerMidi=base+pair.center,sideMidi=base+pair.side;
  return Object.freeze({id:`bell-${octave}-${pair.natural.toLowerCase()}`,octave,column,natural:pair.natural,
    centerMidi,sideMidi,centerName:pitchLabel(centerMidi),sideName:pitchLabel(sideMidi),sameSide:centerMidi===sideMidi,sizeRatio:pair.size});
}
export function pairedPositionForMidi(midi){
  if(!isPairedPitch(midi))return null;
  const octave=Math.floor(midi/12)-1;
  if(midi===96)return {bell:pairedBellAt(6,5),zone:'side'};
  const bells=BELL_PAIRS.map((_,column)=>pairedBellAt(octave,column));
  const center=bells.find(bell=>bell.centerMidi===midi);
  if(center)return {bell:center,zone:'center'};
  const side=bells.find(bell=>bell.sideMidi===midi);
  if(side)return {bell:side,zone:'side'};
  return null;
}
export function unsupportedPitches(events=[]){return [...new Set(events.map(e=>e.midi).filter(midi=>!isPairedPitch(midi)))].sort((a,b)=>a-b);}
export function pitchFitsBank(midi,low,rows){return isPairedPitch(midi)&&midi>=(low+1)*12&&midi<=(low+1+rows)*12;}
