import {tr} from './i18n.mjs';
import {pitchLabel} from './paired-instrument.mjs';
import {pitchNotation} from './score-workspace.mjs';

// Display only: the instrument and recordings always keep absolute MIDI.
export function displayPitch(midi,notation='pitch',key='C'){
  const name=pitchLabel(midi);
  if(notation!=='numbered'||name==='—')return {text:name,label:name,description:name,octave:0};
  const {degree,accidental,octave}=pitchNotation(midi,key),text=`${accidental}${degree}`;
  const above=['','\u0307','\u0308','\u20db'],below=['','\u0323','\u0324','\u20e8'];
  const label=text+(octave>0?above[octave]||` (+${octave})`:octave<0?below[-octave]||` (${octave})`:'');
  const description=octave>0?tr`${text}，上加 ${octave} 点`:octave<0?tr`${text}，下加 ${-octave} 点`:text;
  return {text,label,description,octave};
}
