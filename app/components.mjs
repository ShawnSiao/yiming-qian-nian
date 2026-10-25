import {t,tr,getLocale,scoreFile} from './i18n.mjs';
import {pitchLabel,registerLabel,registerRange,unsupportedPitches} from './paired-instrument.mjs';
import {formatTime} from './session.mjs';
import {BELL_PARTS,BELL_OVERVIEW,STRUCTURE_SOURCES} from './data/bell-structure.mjs';
import {measuresFor} from './practice-model.mjs';

const {createElement:h,useEffect,useRef}=window.React;
const iconPaths={
  eye:'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  book:'M12 6C9 4 5 4 2 5v14c3-1 7-1 10 1m0-14c3-2 7-2 10-1v14c-3-1-7-1-10 1V6',
  reset:'M3 9a9 9 0 1 1 0 6M3 3v6h6',play:'M8 4v16l13-8L8 4',pause:'M8 5v14M16 5v14',
  check:'M5 12l4 4L19 6',back:'M15 5l-7 7 7 7',close:'M6 6l12 12M18 6 6 18',
  sound:'M11 4 5 9H2v6h3l6 5V4M15 8c3 2 3 6 0 8M18 4c6 4 6 12 0 16',
  mute:'M11 4 5 9H2v6h3l6 5V4M16 9l6 6M22 9l-6 6',
  home:'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
  menu:'M4 6h16M4 12h16M4 18h16',
  cube:'M12 3 3 8v9l9 5 9-5V8l-9-5M3 8l9 5 9-5M12 13v9',
};
export function Icon({name}){return h('svg',{viewBox:'0 0 24 24',width:18,height:18,fill:'none',stroke:'currentColor',strokeWidth:1.6,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:iconPaths[name]||iconPaths.play}));}
export function Header({view,onView,onSettings,onMore,onLanguage,context,feedback,modelControl,playControls}){
  return h('header',{className:'app-header'},
    h('button',{className:'brand',onClick:()=>onView('home'),'aria-label':t('返回首页')},h(Icon,{name:'home'}),h('span',null,t('先秦礼乐 · 数字演奏')),h('strong',null,t('一鸣千年'))),
    h('nav',{'aria-label':t('主导航')},[['play',t('演奏')],['library',t('乐谱')],['observe',t('观赏')],['works',t('我的')]].map(([id,label])=>h('button',{key:id,onClick:()=>onView(id),'aria-current':view===id?'page':undefined},label))),
    view==='play'&&h('p',{className:'compact-play-context','aria-live':'polite'},h('span',null,context),h('strong',null,feedback)),
    view==='play'&&h('div',{className:'compact-play-controls'},playControls),
    h('div',{className:'header-tools'},modelControl,h('button',{className:'quiet language-toggle',onClick:onLanguage,'aria-label':getLocale()==='en'?'Switch to Chinese':'切换为英文',title:getLocale()==='en'?'Switch to Chinese':'切换为英文'},getLocale()==='en'?'中文':'EN'),view==='home'&&h('button',{className:'icon-button home-more-entry',onClick:onMore,'aria-label':t('更多选项')},h(Icon,{name:'menu'})),view==='play'&&h('button',{className:'quiet settings-entry',onClick:onSettings,'aria-label':t('练习设置')},t('练习设置'))));
}
export const homeThemes={
  relief:{label:'纹饰',text:'钟乳与带状纹饰沿钟身排列，转动可以看见浮雕层次。'},
  cavity:{label:'钟腔',text:'钟口敞开，内部没有钟舌；敲击外壁，使钟体振动发声。'},
  rack:{label:'钟架',text:'钟悬在铜木结构的架上；一组四口是本页的现代演奏编排。'},
};
export function HomeTitle(){return h('div',{className:'home-title'},h('p',{className:'eyebrow'},t('先秦礼乐 · 数字演奏')),h('h1',null,getLocale()==='en'?'A Thousand Echoes':t('一鸣千年')),h('p',{className:'home-lead'},t('一口钟，两种声音。')));}
export function ModelModeControl({enabled,status,onChange,onRetry}){
  return h('div',{className:'model-mode-controls'},h('button',{type:'button',className:'quiet model-switch',role:'switch','aria-label':t('3D 展示'),'aria-checked':enabled,'data-enabled':enabled,title:t(enabled?'关闭 3D 展示':'开启 3D 展示'),onClick:()=>onChange(!enabled)},h(Icon,{name:'cube'}),h('span',null,'3D')),
    status==='loading'&&h('span',{className:'model-state',role:'status'},t('准备中…')),
    ['error','unsupported'].includes(status)&&h('span',{className:'model-state',role:'status'},t(status==='unsupported'?'3D 不可用':'3D 未就绪'),h('button',{className:'text-button',onClick:onRetry},t('重试'))));
}
export function HomeGuide({heard,last,onTone,onStart,onFree,onObserve,threeD=false}){
  const complete=heard.center&&heard.side;
  const title=complete?t('同一口钟，听见了两种音高。'):heard.center?t('再试试任一侧边，听听有什么不同。'):t('先敲中央，再试试两侧。');
  return h('div',{className:'home-guide','data-complete':complete},
    h('p',{className:'home-invitation','aria-live':'polite'},title),
    h('div',{className:'mobile-home-guidance','aria-live':'polite'},h('span',{className:'listen-progress','aria-hidden':true},h('i',{className:heard.center?'heard':''}),h('i',{className:heard.side?'heard':''})),h('p',null,complete?t('两处击点，两种声音。'):heard.center?t('再试侧边，听听另一种音高。'):heard.side?t('再敲中央，比较两种音高。'):t('轻敲中央，听第一声。'))),
    h('div',{className:'audition-steps','aria-label':t('比较一钟双音')},
      h('button',{className:heard.center?'audition done':'audition',onClick:()=>onTone('center')},h('span',{className:'step-mark'},heard.center?h(Icon,{name:'check'}):t('壹')),h('span',null,t('听中央')),h('strong',null,pitchLabel(60))),
      h('button',{className:heard.side?'audition done':'audition',onClick:()=>onTone('left')},h('span',{className:'step-mark'},heard.side?h(Icon,{name:'check'}):t('贰')),h('span',null,t('听侧边')),h('strong',null,pitchLabel(64)))),
    h('p',{className:'home-feedback','aria-live':'polite'},last?`${last.region==='center'?t('中央正鼓'):t('侧鼓')} · ${pitchLabel(last.midi)}${complete?t(' · 现在试着敲一句'):''}`:t(threeD?'轻点钟面试听，按住钟体拖动旋转。':'轻点钟面试听。')),
    h('div',{className:'home-actions'},h('button',{className:'primary',onClick:onStart},h('span',null,t('叁')),h('b',{className:'desktop-start-label'},t('跟敲第一句')),h('b',{className:'mobile-start-label'},t('开始演奏')),h(Icon,{name:'play'})),h('button',{className:'text-button free-entry',onClick:onFree},t('自由演奏'))),
    h('button',{className:'text-button mobile-observe-entry',onClick:onObserve},t('观赏细节'),h(Icon,{name:'eye'})));
}
export function HomeStudy({theme,onTheme,onZoom,onReset,onObserve,ready,arrivalAudio,onArrival,volume,onVolume}){
  return h('aside',{className:'home-study','aria-label':t('单钟观察')},
    h('div',{className:'home-study-top'},h('div',{className:'theme-tabs','aria-label':t('观察主题')},Object.entries(homeThemes).map(([key,topic])=>h('button',{key,'aria-pressed':theme===key,onClick:()=>onTheme(key)},t(topic.label)))),
      ready&&h('div',{className:'view-tools','aria-label':t('模型视角')},h('button',{'aria-label':t('缩小编钟'),onClick:()=>onZoom(.84)},'−'),h('button',{'aria-label':t('放大编钟'),onClick:()=>onZoom(1.19)},'+'),h('button',{onClick:onReset},t('正面')))),
    h('p',{'aria-live':'polite'},t(!ready&&theme==='relief'?'钟乳与带状纹饰沿钟身排列。':homeThemes[theme].text)),
    h('div',{className:'study-links'},h('button',{className:'study-link',onClick:onObserve},t('观察钟体结构'),h(Icon,{name:'eye'})),h('div',{className:'home-audio-tools'},h('div',{className:'arrival-sound'},h('button',{className:'text-button',onClick:onArrival,'aria-label':t('重听落钟声')},h(Icon,{name:'sound'}),t('重听落钟'))),h('label',{className:'home-volume'},h('span',null,t('音量')),h('input',{type:'range',min:0,max:100,step:1,value:Math.round(volume*100),'aria-label':t('首页钟声音量'),'aria-valuetext':`${Math.round(volume*100)}%`,onChange:e=>onVolume(Number(e.target.value)/100)}),h('output',null,`${Math.round(volume*100)}%`)))));
}
export function Note({note,current=false,played=false,onAudition}){
  return h('button',{className:`score-note${current?' current':''}${played?' played':''}`,onClick:()=>onAudition(note.midi),'aria-current':current?'step':undefined,'aria-label':tr`试听简谱 ${note.accidental||''}${note.degree}，音名 ${pitchLabel(note.midi)}，${note.duration} 拍${note.uncertain?t('，待核对'):''}`},
    h('span',{className:'notation'},h('sup',null,note.octave>0?'·'.repeat(note.octave):''),h('b',null,`${note.accidental||''}${note.degree}`),h('sub',null,note.octave<0?'·'.repeat(-note.octave):''),note.uncertain&&h('i',null,'＊')),
    h('span',{className:'note-pitch'},pitchLabel(note.midi)),h('small',null,tr`${note.duration}拍`));
}
export function ScoreAside({song,measures,bar,index,active,onBar,onPractice,onListen,onAudition,playable=true}){
  const list=useRef(null);
  useEffect(()=>{list.current?.querySelector('.measure.selected')?.scrollIntoView({block:'nearest',behavior:'auto'});},[bar]);
  return h('aside',{className:'score-aside','aria-label':t('对照乐谱')},
    h('div',{className:'score-heading'},h('p',{className:'eyebrow'},t('边看谱，边落槌')),h('h2',null,t(song.title)),h('p',null,`1=${song.scoreKey||'C'} · ${song.bpm} BPM · ${measures.length} ${song.jianpuBars?t('小节'):t('乐句')}`)),
    song.transcriptionStatus&&h('p',{className:'draft-note'},t('录音转谱初稿 · ＊为待核对击音')),
    h('div',{className:'measure-list',ref:list},measures.map((m,i)=>h('section',{key:i,className:i===bar?'measure selected':'measure'},h('button',{className:'measure-select',onClick:()=>onBar(i),'aria-label':t(m.label),'aria-current':i===bar?'step':undefined},h('span',null,String(i+1).padStart(2,'0')),h('strong',null,m.notes.map(n=>`${n.accidental||''}${n.degree}${n.uncertain?'＊':''}`).join('　'))),i===bar&&h('div',{className:'measure-detail'},m.notes.map((n,j)=>h(Note,{key:j,note:n,current:active&&j===index,played:active&&j<index,onAudition})))))),
    !playable&&h('p',{className:'pitch-availability'},t('当前曲谱含未设置击点的音，请换曲。')),
    h('div',{className:'score-aside-actions'},h('button',{className:'secondary',disabled:!playable,onClick:onListen},t('听这一句')),h('button',{className:'primary',disabled:!playable,onClick:onPractice},t('跟着敲'))));
}
export function PhraseStrip({measure,bar,count,index,phase,paused,feedback,onPrev,onNext,onListen,onPractice,onPause,onStop,onRetry,onAudition,muted,onMute,recording,elapsed,onRecord,recordCount,playback,playable=true}){
  const active=['wait','listen','timed','work'].includes(phase),done=phase==='done';
  const run=useRef(null);
  useEffect(()=>{run.current?.querySelector('[aria-current=step]')?.scrollIntoView({block:'nearest',inline:'center',behavior:'auto'});},[index,phase]);
  return h('footer',{className:'practice-footer','data-phase':phase},
    h('div',{className:'phrase-status','aria-live':'polite'},h('span',{className:'phrase-count'},recording?t('录钟曲'):playback?t('作品回放'):`${bar+1} / ${count} ${measure.label.includes('小节')?t('小节'):t('乐句')}`),h('strong',null,recording?tr`已录 ${recordCount} 次落槌 · ${formatTime(elapsed)}`:!playable&&!playback?t('当前曲谱含未设置击点的音，请换曲。'):feedback),h('span',{className:'step-count'},active&&!playback?tr`${Math.min(index+1,measure.notes.length)} / ${measure.notes.length} 击`:t('一组四口 · 中央与两角可敲'))),
    playback||recording?h('div',{className:'playback-summary'},recording?t('轻敲钟面，保存这一段灵感。'):playback):h('div',{className:'phrase-strip','aria-label':t('当前乐句')},h('button',{className:'icon-button',disabled:bar===0,onClick:onPrev,'aria-label':t('上一句')},'‹'),h('div',{className:'note-run',ref:run},measure.notes.map((n,j)=>h(Note,{key:j,note:n,current:active&&j===index,played:active&&j<index,onAudition}))),h('button',{className:'icon-button',disabled:bar===count-1,onClick:onNext,'aria-label':t('下一句')},'›')),
    h('div',{className:`transport-controls${recording?' recording-controls':''}`},recording?h('button',{className:'secondary is-recording',onClick:onRecord},'■',tr`保存 ${formatTime(elapsed)}`):active?h('button',{className:'secondary',onClick:onPause},h(Icon,{name:paused?'play':'pause'}),paused?t('继续'):t('暂停')):h('button',{className:'secondary',disabled:!playable,onClick:onListen},h(Icon,{name:'play'}),t('听这一句')),
      !recording&&(
      active?h('button',{className:'text-button',onClick:onStop},playback?t('结束回放'):phase==='listen'?t('停止试听'):t('结束练习')):done?h('button',{className:'primary',onClick:bar===count-1?onRetry:onNext},bar===count-1?t('再练这一句'):t('下一句'),h(Icon,{name:'play'})):h('button',{className:'primary',disabled:!playable,onClick:onPractice},t('跟着敲'),h(Icon,{name:'play'}))),
      done&&!recording&&h('button',{className:'text-button',onClick:onRetry},t('再练一次')),!active&&!recording&&h('button',{className:'icon-button record-control','aria-label':t('录钟曲'),title:t('录钟曲'),onClick:onRecord},h('span',{'aria-hidden':true},'●')),h('button',{className:'icon-button mute-control','aria-label':muted?t('开启声音'):t('静音'),'aria-pressed':muted,onClick:onMute},h(Icon,{name:muted?'mute':'sound'}))));
}
export function BankPicker({low,rows,onBank,disabled=false}){
  return h('label',{className:'bank-picker'},h('span',null,t('音组')),h('select',{'aria-label':t('切换音组'),value:low,disabled,onChange:e=>onBank(Number(e.target.value))},Array.from({length:5-rows},(_,i)=>i+3).map(n=>h('option',{key:n,value:n},registerRange(n,rows)))));
}
export function SourceCompare({song,onSource}){
  const player=useRef(null);
  useEffect(()=>{const element=player.current;return()=>element?.pause();},[song.id]);
  if(!song.sourceAudio)return null;
  return h('details',{className:'source-compare'},h('summary',null,t('原音对照与谱文件')),
    h('audio',{key:song.id,ref:player,controls:true,preload:'none',src:song.sourceAudio,onPlay:onSource,'aria-label':t('竹枝词用户录音原音对照')}),
    song.scoreWarning&&h('p',{className:'draft-note'},t(song.scoreWarning)),
    h('div',{className:'score-files'},Object.entries(song.scoreFiles||{}).map(([type,url])=>h('a',{key:type,href:scoreFile(type,url),download:type!=='html',target:type==='html'?'_blank':undefined,rel:type==='html'?'noopener':undefined},type==='html'?t('完整谱页'):type==='midi'?'MIDI':'MusicXML'))));
}
export function WorksPage({works,onPlay,onRecord,onSave,onRename}){
  return h('section',{className:'works-page','data-screen-label':t('我的钟曲')},h('header',{className:'page-title'},h('p',{className:'eyebrow'},t('留下一段金石之声')),h('h1',null,t('我的钟曲')),h('p',null,tr`${works.length} 首本地作品 · 最多保留 30 首`)),
    works.length?h('div',{className:'works-list'},works.map((work,i)=>h('article',{className:'song-row',key:work.id},h('span',{className:'song-number'},String(i+1).padStart(2,'0')),h('div',{className:'song-info'},h('strong',null,work.title),h('span',null,tr`${formatTime(work.durationMs)} · ${work.events.length} 次落槌`)),h('button',{className:'text-button rename-work','aria-label':tr`修改${work.title}的曲名`,onClick:()=>onRename(work)},t('改名')),h('button',{className:'secondary','aria-label':tr`播放${work.title}`,onClick:()=>onPlay(work)},h(Icon,{name:'play'}),t('播放')))),h('button',{className:'text-button save-works',onClick:onSave},t('重试本地保存'))):
      h('div',{className:'empty-works'},h('h2',null,t('从第一声开始。')),h('p',null,t('演奏时点「●」录钟曲，把落槌保存到本机。')),h('button',{className:'primary',onClick:onRecord},t('去敲一曲'))));
}
export function LibraryPage({songs,selected,filter,onFilter,onSelect,onStart,onListen,onAudition,onBar,onSource}){
  const measures=measuresFor(selected),selectedMissing=unsupportedPitches(selected.events);
  return h('section',{className:'library-page','data-screen-label':t('选曲与乐谱')},
    h('header',{className:'page-title'},h('p',{className:'eyebrow'},t('从熟悉的旋律开始')),h('h1',null,t('听一遍，再敲一句。')),h('p',null,t('先选一小段，找到亮起的击点。'))),
    h('div',{className:'library-layout'},h('div',{className:'library-main'},
      h('section',{className:'first-piece','aria-label':t('第一次推荐')},h('p',{className:'eyebrow'},t('第一次试试')),h('div',null,h('div',null,h('h2',null,t('竹枝词 · 第一小节')),h('p',null,t('5 次落槌 · 先慢慢敲对'))),h('button',{className:'primary',onClick:()=>onStart(songs.find(s=>s.id==='zhuzhi-ci'),0)},t('开始第一句'),h(Icon,{name:'play'})))),
      getLocale()==='en'&&h('details',{className:'notation-help'},h('summary',null,'Reading the numbered score'),h('p',null,'Numbers 1–7 are scale degrees; the key tells you the pitch of 1. Dots above or below move a note up or down an octave. Pitch names such as C4 show exactly which bell to strike.')),
      h('div',{className:'library-filters','aria-label':t('曲目分类')},['全部','入门','民间','熟悉旋律','流行'].map(x=>h('button',{key:x,'aria-pressed':filter===x,onClick:()=>onFilter(x)},t(x)))),
      h('div',{className:'song-list'},songs.filter(s=>filter==='全部'||s.category===filter).map((s,i)=>{
        const missing=unsupportedPitches(s.events);
        return h('article',{key:s.id,className:selected.id===s.id?'song-row selected':'song-row','data-song-id':s.id,'data-playable':missing.length===0},h('span',{className:'song-number'},String(i+1).padStart(2,'0')),h('button',{className:'song-info',onClick:()=>onSelect(s),'aria-pressed':selected.id===s.id},h('strong',null,t(s.title)),h('span',null,`${t(s.category)} · ${formatTime(s.durationMs)} · ${measuresFor(s).length} ${s.jianpuBars?t('小节'):t('乐句')}`),missing.length>0&&h('em',{className:'pitch-availability'},tr`待补音：${missing.map(pitchLabel).join('、')}`),s.transcriptionStatus&&h('em',null,t('录音转谱初稿'))),h('button',{className:'song-preview icon-button',disabled:missing.length>0,onClick:()=>onListen(s),'aria-label':tr`试听${t(s.title)}`},h(Icon,{name:'play'})),h('button',{className:'text-button song-practice',disabled:missing.length>0,onClick:()=>onStart(s,0)},t(missing.length?'待补音':'逐句练习')),
          selected.id===s.id&&h('div',{className:'song-inline-preview'},h('p',null,t(s.description)),s.transcriptionStatus&&h('p',{className:'draft-note'},t('录音转谱初稿，＊为待核对击音。')),h('button',{className:'secondary',onClick:()=>onBar(s,0)},t('查看曲谱'),h(Icon,{name:'book'})),h(SourceCompare,{song:s,onSource})));
      }))),
      h('aside',{className:'library-score','aria-label':t('所选曲谱')},h('p',{className:'eyebrow'},t('所选曲谱')),h('h2',null,t(selected.title)),h('p',{className:'song-description'},t(selected.description)),selected.transcriptionStatus&&h('p',{className:'draft-note'},t('录音转谱初稿，未完成逐音听校。＊为待核对击音。')),h('p',{className:'score-meta'},`1=${selected.scoreKey||'C'} · ${selected.bpm} BPM`),
        h('div',{className:'library-bars'},measures.map((m,i)=>h('button',{key:i,className:'library-bar',onClick:()=>onBar(selected,i),'aria-label':tr`看谱演奏${t(m.label)}`},h('small',null,String(i+1).padStart(2,'0')),h('span',null,m.notes.map(n=>`${n.accidental||''}${n.degree}${n.uncertain?'＊':''}`).join('　'))))),
        selectedMissing.length>0&&h('p',{className:'pitch-availability'},tr`待补音：${selectedMissing.map(pitchLabel).join('、')}`),
        h(SourceCompare,{song:selected,onSource}),h('div',{className:'library-score-actions'},h('button',{className:'secondary',disabled:selectedMissing.length>0,onClick:()=>onListen(selected)},t('听示范')),h('button',{className:'primary',disabled:selectedMissing.length>0,onClick:()=>onStart(selected,0)},t('逐句练习'))))));
}
export function ObservePanel({part,onPart,theme,onTheme,onBack,onCompare,onView,onCut,onZoom,cut,ready}){
  const info=part==='overview'?BELL_OVERVIEW:BELL_PARTS.find(x=>x.id===part)||BELL_OVERVIEW;
  return h('aside',{className:'observe-panel'},h('p',{className:'eyebrow'},t('从声音，认识一口甬钟')),h('h1',null,t('看见钟里的结构。')),
    h('div',{className:'theme-tabs'},[['relief',t('纹饰')],['cavity',t('钟腔')],['rack',t('钟架')]].map(([id,label])=>h('button',{key:id,'aria-pressed':theme===id,onClick:()=>onTheme(id)},label))),
    h('p',{className:'observe-intro'},theme==='rack'?t('背景钟架展示悬挂场景；本页的四钟音组是现代演奏编排。'):t(!ready&&theme==='relief'?'钟乳与带状纹饰沿钟身排列。':homeThemes[theme].text)),
    h('label',{className:'part-picker'},h('span',null,t('选择部位')),h('select',{'aria-label':t('选择编钟部位'),value:part,onChange:e=>onPart(e.target.value)},h('option',{value:'overview'},t('整体 · 甬钟')),BELL_PARTS.map(p=>h('option',{key:p.id,value:p.id},`${t(p.name)} · ${t(p.reading)}`)))),
    h('article',{className:'part-explanation','aria-live':'polite'},h('p',{className:'eyebrow'},t(info.reading)),h('h2',null,t(info.name)),h('p',null,t(info.text)),info.note&&h('p',{className:'model-boundary'},t(info.note))),
    ready&&h('div',{className:'observe-tools',role:'group','aria-label':t('模型视角与剖视')},h('button',{className:'secondary',disabled:!ready,'aria-label':t('恢复正面视角'),onClick:()=>onView('front')},t('正面')),h('button',{className:'secondary',disabled:!ready,'aria-label':t('查看编钟侧面'),onClick:()=>onView('side')},t('侧面')),h('button',{className:'secondary',disabled:!ready,'aria-label':t('从钟口观察内腔'),onClick:()=>onView('cavity')},t('钟腔')),h('button',{className:'secondary',disabled:!ready,'aria-pressed':cut,onClick:onCut},cut?t('关闭剖视'):t('剖视')),h('button',{className:'secondary',disabled:!ready,onClick:()=>onZoom(.84),'aria-label':t('缩小观赏模型')},'−'),h('button',{className:'secondary',disabled:!ready,onClick:()=>onZoom(1.19),'aria-label':t('放大观赏模型')},'+')),
    h('div',{className:'source-links'},h('span',null,t('资料出处')),(info.sources||[]).map(key=>STRUCTURE_SOURCES[key]).filter(Boolean).map(source=>h('a',{key:source.url,href:source.url,target:'_blank',rel:'noopener'},t(source.name),' ↗'))),
    h('p',{className:'model-boundary'},t('照片参考建模，非实物测绘；剖视为结构示意，未做声学模拟。')),h('div',{className:'observe-actions'},h('button',{className:'secondary',onClick:onCompare},t('返回双音试听')),h('button',{className:'primary',onClick:onBack},t('回到演奏'))));
}
