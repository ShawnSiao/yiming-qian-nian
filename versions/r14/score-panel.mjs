import {noteName} from './session.mjs';
import {scoreMeasures,scoreLocation} from './score-workspace.mjs';
const {createElement:h,useEffect,useMemo,useRef}=window.React;

function ScoreNote({note,current=false}){
  return h('span',{className:`reading-note${current?' is-current':''}`,'aria-label':`${noteName(note.midi)}，${note.duration} 拍${note.uncertain?'，待核对':''}`},
    h('sup',null,note.octave>0?'·'.repeat(note.octave):''),
    h('b',null,note.tie?'⌒':'',note.accidental,note.degree,note.uncertain?h('i',null,'＊'):null),
    h('sub',null,note.octave<0?'·'.repeat(-note.octave):''),h('small',null,noteName(note.midi)),
    h('em',null,`${Math.round(note.duration*100)/100}拍`));
}
export function ScorePanel({song,songs,eventIndex,following,onFollowing,manualBar,onBar,onSong,side,onSide,onPlay}){
  const measures=useMemo(()=>scoreMeasures(song),[song]),cursor=scoreLocation(song,eventIndex,measures);
  const active=following&&eventIndex!==null?cursor.bar:Math.min(manualBar,Math.max(0,measures.length-1));
  const list=useRef(null);
  useEffect(()=>{if(following&&eventIndex!==null)list.current?.querySelector(`[data-measure="${active}"]`)?.scrollIntoView({block:'nearest',behavior:'auto'});},[active,following,eventIndex===null]);
  return h('aside',{className:'score-panel','aria-label':'演奏对照曲谱','data-song-id':song?.id,'data-active-measure':active+1},
    h('header',{className:'score-panel-heading'},h('h2',null,'对照曲谱'),
      h('button',{className:'quiet-button','aria-label':side==='right'?'将曲谱移到左侧':'将曲谱移到右侧',onClick:onSide},side==='right'?'移到左侧':'移到右侧')),
    h('select',{'aria-label':'演奏曲谱',value:song?.id||'',onChange:e=>onSong(e.target.value),disabled:eventIndex!==null},songs.map(s=>h('option',{key:s.id,value:s.id},s.title))),
    h('div',{className:'score-panel-meta'},h('span',null,`1=${song?.scoreKey||'C'} · ${song?.bpm||''} BPM${song?.jianpuBars?'':' · 按事件分句'}`),
      h('button',{className:'quiet-button','aria-pressed':following,onClick:()=>onFollowing(!following)},following?'跟随乐句':'恢复跟随')),
    song?.transcriptionStatus&&h('p',{className:'score-draft-note'},'转谱初稿 · ＊ 待核对，非审定谱'),
    h('div',{className:'score-measures',ref:list,onWheel:()=>onFollowing(false),onTouchStart:()=>onFollowing(false)},measures.map(measure=>
      h('button',{key:measure.index,className:`score-measure${active===measure.index?' is-active':''}`,'data-measure':measure.index,'aria-label':measure.label,'aria-current':active===measure.index?'step':undefined,onClick:()=>{onFollowing(false);onBar(measure.index);}},
        h('span',{className:'reading-bar-number'},String(measure.index+1).padStart(2,'0')),
        h('span',{className:'reading-notes'},measure.notes.map((note,i)=>h(ScoreNote,{key:i,note,current:following&&cursor.beat===note.beat&&cursor.midi===note.midi})))))),
    h('footer',{className:'score-panel-footer'},h('span',null,`${active+1} / ${measures.length} ${song?.jianpuBars?'小节':'乐句'}`),
      h('div',null,h('button',{className:'quiet-button',disabled:eventIndex!==null,onClick:()=>onPlay(song,'listen')},'听一遍'),h('button',{className:'quiet-button',disabled:eventIndex!==null,onClick:()=>onPlay(song,'follow')},'跟着敲'))));
}
export function ScoreStrip({song,eventIndex,following,manualBar,onBar,onFollowing}){
  const measures=useMemo(()=>scoreMeasures(song),[song]),cursor=scoreLocation(song,eventIndex,measures);
  const active=following&&eventIndex!==null?cursor.bar:Math.min(manualBar,Math.max(0,measures.length-1));
  const measure=measures[active],phrase=useRef(null);
  useEffect(()=>{if(following&&eventIndex!==null)phrase.current?.querySelector('.is-current')?.scrollIntoView({block:'nearest',inline:'center',behavior:'auto'});},[cursor.beat,following,eventIndex===null]);
  function move(delta){onFollowing(false);onBar(Math.max(0,Math.min(measures.length-1,active+delta)));}
  return h('div',{className:'compact-score','aria-label':'当前对照乐句','data-active-measure':active+1},
    h('button',{className:'icon-button','aria-label':'上一乐句',disabled:active===0,onClick:()=>move(-1)},'‹'),
    h('button',{className:'compact-phrase','aria-label':eventIndex!==null&&!following?'恢复曲谱跟随':measure?.label,onClick:()=>{if(eventIndex!==null)onFollowing(true);}},h('small',null,`${active+1}/${measures.length}${eventIndex!==null&&!following?' · 恢复跟随':''}`),
      h('span',{className:'compact-notes',ref:phrase},measure?.notes.map((note,i)=>h('span',{key:i,className:following&&cursor.beat===note.beat&&cursor.midi===note.midi?'is-current':'',title:noteName(note.midi)},h('b',null,noteName(note.midi)),h('small',null,`${Math.round(note.duration*100)/100}拍`))))),
    h('button',{className:'icon-button','aria-label':'下一乐句',disabled:active>=measures.length-1,onClick:()=>move(1)},'›'));
}
