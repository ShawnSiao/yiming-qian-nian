import { InstrumentScene } from './instrument.mjs';
import { Transport, readWorks, saveWorks, formatTime, noteName, scoreEvents, sectionAccompaniment, pitchRange, practiceSections, practiceBank, rangeFits } from './session.mjs';
import {unsupportedPitches,registerLabel,registerMark} from './paired-instrument.mjs';
import { observeViewport, supportsFullscreen, simulatedSafeArea } from './mobile-viewport.mjs';
import {ScorePanel,ScoreStrip} from './score-panel.mjs';
import {workspaceSplit,clampSplitFraction} from './score-workspace.mjs';

const {createElement:h,useState,useEffect,useRef}=window.React;
const songs=window.YMQNSongs||[];
function followWarning(song){const missing=unsupportedPitches(song.events);return missing.length?`当前音位不含 ${missing.map(noteName).join('、')}，可试听原调；暂不支持跟奏。`:'';}
const simulated=new URLSearchParams(location.search).get('safe');
for(const [side,value] of Object.entries(simulatedSafeArea(simulated)))document.documentElement.style.setProperty(`--safe-${side}`,`${value}px`);
function Icon({name}){
  if(name==='gear')return h('span',{'aria-hidden':true,className:'gear-glyph'},'⚙\uFE0E');
  const paths={
    expand:'M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5',
    sound:'M11 4 5 9H2v6h3l6 5V4M15 8c3 2 3 6 0 8M18 4c6 4 6 12 0 16',
    mute:'M11 4 5 9H2v6h3l6 5V4M16 9l6 6M22 9l-6 6',
    reset:'M3 9a9 9 0 1 1 0 6M3 3v6h6',
    eye:'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    book:'M12 6C9 4 5 4 2 5v14c3-1 7-1 10 1m0-14c3-2 7-2 10-1v14c-3-1-7-1-10 1V6',
    gear:'M9 3h6l.6 3 2.6 1.5 2.9-.9 3 5.2-2.3 2 .1 3 2.2 2-3 5.2-2.9-.9-2.6 1.5L15 24H9l-.6-3-2.6-1.5-2.9.9-3-5.2 2.3-2-.1-3-2.2-2 3-5.2 2.9.9L8.4 3M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    back:'M15 5l-7 7 7 7',close:'M6 6l12 12M18 6 6 18',
    play:'M8 4v16l13-8L8 4',pause:'M8 5v14M16 5v14',stop:'M6 6h12v12H6Z',check:'M5 12l4 4L19 6',
  };
  // Settings uses the familiar gear silhouette, inset to fit the icon box.
  return h('svg',{width:18,height:18,viewBox:name==='gear'?'-2 -2 28 28':'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.5,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:paths[name]}));
}
function RecordingScore({song}){
  return h('section',{className:'recording-score','aria-label':song.notationLabel},
    h('p',{className:'score-meta'},`1=${song.scoreKey} · ${song.scoreMeter} · 约 ${song.bpm} BPM · ${noteName(62)}–${noteName(86)}`),
    h('p',{className:'score-warning'},song.scoreWarning),
    h('details',{className:'source-compare'},h('summary',null,'原音对照与谱文件'),
      h('audio',{controls:true,preload:'none',src:song.sourceAudio,'aria-label':'竹枝词用户录音原音对照'}),
      h('div',{className:'score-files'},h('a',{href:song.scoreFiles.musicxml,download:true},'MusicXML'),h('a',{href:song.scoreFiles.midi,download:true},'MIDI'),h('a',{href:song.scoreFiles.html,target:'_blank',rel:'noopener'},'完整谱页'))),
    h('div',{className:'recording-bars'},song.jianpuBars.map((bar,i)=>h('div',{className:'recording-bar',key:i,'aria-label':`第 ${i+1} 小节`},
      h('small',{className:'bar-number'},String(i+1).padStart(2,'0')),
      h('div',{className:'recording-bar-notes'},bar.map((n,j)=>h('span',{className:'recording-note',key:j,'aria-label':`${noteName(n.midi)}，${n.duration} 拍${n.uncertain?'，待核对':''}`},
        h('sup',null,n.octave>0?'·'.repeat(n.octave):''),
        h('b',null,n.tie?'⌒':'',n.accidental,n.degree,n.uncertain?h('i',null,'＊'):null),
        h('sub',null,n.octave<0?'·'.repeat(-n.octave):''),h('small',null,`${n.duration}拍`))))))));
}
function App(){
  const [view,setView]=useState(()=>{const v=new URLSearchParams(location.search).get('view');return ['play','observe','library','works'].includes(v)?v:'play';}),[loaded,setLoaded]=useState(false),[error,setError]=useState('');
  const [measure,setMeasure]=useState(null),[last,setLast]=useState(null),[labels,setLabels]=useState(true);
  const [muted,setMuted]=useState(false),[choice,setChoice]=useState('auto'),[startOctave,setStartOctave]=useState(4);
  const [cutaway,setCutaway]=useState(false),[settings,setSettings]=useState(false),[diagnostics,setDiagnostics]=useState(false);
  const [works,setWorks]=useState(readWorks),[recording,setRecording]=useState(false),[elapsed,setElapsed]=useState(0);
  const [selected,setSelected]=useState(null),[filter,setFilter]=useState('全部'),[session,setSession]=useState(null),[toast,setToast]=useState('');
  const [accompaniment,setAccompaniment]=useState(true),[followRate,setFollowRate]=useState(.72);
  const [scoreSongId,setScoreSongId]=useState(()=>songs.find(s=>s.id===new URLSearchParams(location.search).get('score'))?.id||'zhuzhi-ci');
  const [showScore,setShowScore]=useState(true),[scoreSide,setScoreSide]=useState('right'),[splitFraction,setSplitFraction]=useState(.72);
  const [workspaceWidth,setWorkspaceWidth]=useState(0),[manualBar,setManualBar]=useState(0),[followingScore,setFollowingScore]=useState(true);
  const workspace=useRef(null),splitDrag=useRef(null),splitFrame=useRef(0);
  const host=useRef(null),engine=useRef(null),transport=useRef(new Transport()),record=useRef(null),currentSession=useRef(null);
  const dialog=useRef(null),details=useRef(null),toastTimer=useRef(0),latestState=useRef({});
  latestState.current={view,recording,session,loaded,works,finishRecording,accompaniment,followingScore};
  function notify(text){clearTimeout(toastTimer.current);setToast(text);toastTimer.current=setTimeout(()=>setToast(''),3600);}
  function stopSession(){transport.current.stop();engine.current?.setTarget(null);engine.current?.audio.stop();currentSession.current=null;setSession(null);}
  function pauseSession(reason='manual'){
    if(record.current&&['blur','hidden','resize'].includes(reason))latestState.current.finishRecording();
    const state=currentSession.current;
    if(!state||!transport.current.running)return;
    transport.current.pause();engine.current?.cancelInput(true);state.paused=true;
    setSession(s=>s?{...s,paused:true,feedback:reason==='resize'?'布局改变，已暂停':'已暂停'}:s);
  }
  function togglePause(){
    const state=currentSession.current;if(!state)return;
    if(transport.current.running){pauseSession();return;}
    if(state.kind==='follow'&&!rangeFits(state.events,engine.current.layout)){notify('完整跟奏需要双排空间；可尝试全屏或旋转屏幕后继续。');return;}
    engine.current.audio.unlock().catch(()=>notify('声音尚未开启，请轻触钟面。'));
    state.paused=false;transport.current.resume();engine.current.setTarget(state.target);
    setSession(s=>s?{...s,paused:false,feedback:'跟着拍点敲'}:s);
  }
  function receiveStrike(event){
    setLast(event);
    const manual=['pointer','keyboard','accessibility','bell-surface'].includes(event.source);
    if(record.current&&manual){
      if(record.current.first===null)record.current.first=event.at;
      record.current.events.push({time:Math.round(event.at-record.current.first),midi:event.midi,zone:event.zone,region:event.region,bellId:event.bellId});
    }
    if(currentSession.current?.kind==='follow'&&manual&&transport.current.running){
      const correct=transport.current.judge(event.midi,event.at);
      setSession(s=>s?{...s,hits:transport.current.hits.size,feedback:correct?'合拍':'听准下一音'}:s);
    }
  }
  useEffect(()=>{
    let cancelled=false;
    engine.current=new InstrumentScene(host.current,{onMeasure:setMeasure,onStrike:receiveStrike,onMessage:notify,onRegisterChange:setStartOctave,onInterrupt:pauseSession,initialMode:latestState.current.view==='observe'?'observe':'play'});
    engine.current.ready.then(()=>{
      if(cancelled)return;
      window.__bellPrototype=Object.freeze({snapshot:()=>({...engine.current?.snapshot(),uiView:latestState.current.view,recording:!!record.current})});setLoaded(true);
    }).catch(e=>setError(`编钟载入失败：${e.message}`));
    return()=>{cancelled=true;transport.current.stop();engine.current?.dispose();clearTimeout(toastTimer.current);delete window.__bellPrototype;};
  },[]);
  useEffect(()=>{
    engine.current?.setOptions({mode:view==='observe'?'observe':'play',active:view==='play'||view==='observe',inspect:true,labels,muted,choice,startOctave,cutaway,diagnostics});
  },[loaded,view,labels,muted,choice,startOctave,cutaway,diagnostics]);
  useEffect(()=>{
    if(loaded){const song=songs.find(s=>s.id===scoreSongId),rows=engine.current.layout?.rows||2;if(song)setStartOctave(practiceBank(song.events,rows)??Math.max(3,Math.min(pitchRange(song.events).low,7-rows)));}
  },[loaded]);
  useEffect(()=>{
    const stopViewport=observeViewport(window,document.documentElement);
    const pause=()=>{if(document.hidden){pauseSession('hidden');if(record.current)latestState.current.finishRecording();}};
    document.addEventListener('visibilitychange',pause);
    return()=>{stopViewport();document.removeEventListener('visibilitychange',pause);};
  },[]);
  useEffect(()=>{if(settings){dialog.current?.showModal();}else dialog.current?.close();},[settings]);
  useEffect(()=>{if(selected)details.current?.showModal();else if(details.current)details.current.close();},[selected]);
  useEffect(()=>{
    const observer=new ResizeObserver(entries=>{const width=entries[0]?.contentRect.width;if(width>0)setWorkspaceWidth(width);});
    if(workspace.current)observer.observe(workspace.current);
    return()=>{observer.disconnect();cancelAnimationFrame(splitFrame.current);};
  },[]);
  useEffect(()=>{if(!recording)return;const id=setInterval(()=>{if(record.current&&record.current.first!==null){const time=performance.now()-record.current.first;setElapsed(time);if(time>=300000)latestState.current.finishRecording();}},200);return()=>clearInterval(id);},[recording]);
  function finishRecording(){
    if(!record.current)return;
    const result=record.current;record.current=null;setRecording(false);setElapsed(0);
    if(!result.events.length){notify('轻触钟面后再保存');return;}
    const previous=latestState.current.works;
    const work={id:`work-${Date.now()}`,title:`我的钟曲 ${String(previous.length+1).padStart(2,'0')}`,createdAt:Date.now(),durationMs:result.events.at(-1).time+800,events:result.events};
    const next=[work,...previous].slice(0,30);
    if(saveWorks(next)){setWorks(next);notify('已保存到「我的」');}else notify('保存失败，当前设备空间可能不足');
  }
  function changeView(next){if(next===view)return;stopSession();if(record.current)finishRecording();setSelected(null);setView(next);setLast(null);}
  function toggleRecord(){if(record.current){finishRecording();return;}if(works.length>=30){notify('已保存 30 首钟曲');return;}stopSession();record.current={first:null,events:[]};setRecording(true);setElapsed(0);}
  function chooseScore(id){
    setScoreSongId(id);setManualBar(0);setFollowingScore(true);
    const song=songs.find(s=>s.id===id);
    if(song&&engine.current){const rows=engine.current.layout?.rows||2;setStartOctave(practiceBank(song.events,rows)??Math.max(3,Math.min(pitchRange(song.events).low,7-rows)));}
  }
  function toggleScore(){pauseSession();engine.current?.cancelInput(true);setShowScore(!showScore);}
  function swapScore(){pauseSession();engine.current?.cancelInput(true);setScoreSide(scoreSide==='right'?'left':'right');}
  function splitStart(event){
    if(recording||event.button!==0)return;
    event.preventDefault();pauseSession();engine.current?.cancelInput(true);
    event.currentTarget.setPointerCapture(event.pointerId);splitDrag.current={id:event.pointerId,element:event.currentTarget};
  }
  function splitMove(event){
    if(splitDrag.current?.id!==event.pointerId)return;
    const bounds=workspace.current.getBoundingClientRect(),relative=(event.clientX-bounds.left)/bounds.width;
    const fraction=clampSplitFraction(scoreSide==='right'?relative:1-relative);
    cancelAnimationFrame(splitFrame.current);splitFrame.current=requestAnimationFrame(()=>{splitFrame.current=0;setSplitFraction(fraction);});
  }
  function splitEnd(event){
    if(splitDrag.current?.id!==event.pointerId)return;
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    splitDrag.current=null;
  }
  function splitKey(event){
    if(recording||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();pauseSession();engine.current?.cancelInput(true);
    const direction=scoreSide==='right'?1:-1;
    setSplitFraction(value=>event.key==='Home' ? .56 : event.key==='End' ? .86 : clampSplitFraction(value+(event.key==='ArrowRight'?1:-1)*.025*direction));
  }
  function begin(item,kind){
    if(!engine.current){notify('编钟仍在载入');return;}
    if(kind==='follow'&&followWarning(item)){notify(followWarning(item));return;}
    engine.current.audio.unlock().catch(()=>notify('声音尚未开启，请轻触钟面。'));
    if(record.current)finishRecording();stopSession();setSelected(null);setView('play');
    if(songs.some(song=>song.id===item.id)){chooseScore(item.id);setShowScore(true);}
    const rate=kind==='follow'?followRate:item.timing==='performance'?1:.9;
    const source=item.events;
    const ticket={item,kind,rate,events:scoreEvents(item,rate,source)};
    currentSession.current=ticket;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(currentSession.current!==ticket)return;
      const rows=engine.current.layout.rows;
      ticket.sections=kind==='follow'?practiceSections(ticket.events,rows):[{events:ticket.events,origin:0,low:practiceBank(ticket.events,rows)??Math.max(3,Math.min(pitchRange(ticket.events).low,7-rows)),offset:0}];
      if(ticket.sections.length>1)notify('当前按音区分段练习，保留曲目中的原始音高。');
      startSection(ticket,0);
    }));
  }
  function startSection(ticket,sectionIndex){
    const part=ticket.sections[sectionIndex];
    if(!part)return;
    transport.current.stop();engine.current?.cancelInput(true);
    const state={...ticket,sectionIndex,events:part.events,kind:ticket.kind,title:ticket.item.title,index:0,total:part.events.length,target:null,hits:0,paused:false,done:false,feedback:ticket.kind!=='follow'?'正在回放':ticket.sections.length>1?`分段练习 ${sectionIndex+1}/${ticket.sections.length}`:'预备四拍'};
    currentSession.current=state;setSession(state);setStartOctave(part.low);
    engine.current.setOptions({startOctave:part.low});
    engine.current.audio.unlock().catch(()=>{});
    const backing=['follow','listen'].includes(ticket.kind)?sectionAccompaniment(ticket.item,ticket.rate,part,ticket.sections[sectionIndex+1]):[];
    const endTime=sectionIndex===ticket.sections.length-1&&ticket.item.sourceDurationMs?ticket.item.sourceDurationMs/ticket.rate-part.origin:undefined;
    transport.current.play(part.events,{follow:ticket.kind==='follow',beatMs:60000/(ticket.item.bpm||90)/ticket.rate,accompaniment:backing,endTime,
      onAccompaniment:e=>{if(ticket.kind==='listen'||latestState.current.accompaniment)engine.current?.audio.strike(e.midi,0,e.velocity).catch(()=>{});},
      onNote:(e,index)=>{engine.current?.strikeMidi(e.midi,'playback',e.velocity,e.region,e.bellId);if(latestState.current.followingScore)setManualBar(ticket.item.jianpuBars?Math.floor(ticket.item.events[part.offset+index].beat/4):Math.floor((part.offset+index)/8));setSession(s=>s?{...s,index:index+1,target:e.midi}:s);},
      onTarget:(e,index)=>{state.target=e.midi;state.targetTime=e.time;engine.current?.setTarget(e.midi);if(latestState.current.followingScore)setManualBar(ticket.item.jianpuBars?Math.floor(ticket.item.events[part.offset+index].beat/4):Math.floor((part.offset+index)/8));setSession(s=>s?{...s,index:index+1,target:e.midi,feedback:'跟着拍点敲'}:s);},
      onTick:tick=>{if(state.targetTime!==undefined)engine.current?.setCue(state.targetTime-tick.elapsed);setSession(s=>s?{...s,tick}:s);},
      onEnd:hits=>{
        engine.current?.setTarget(null);
        if(ticket.kind==='follow'){state.done=true;setSession(s=>s?{...s,done:true,target:null,hits,feedback:`跟上 ${hits}/${part.events.length} 个音`}:s);}
        else{currentSession.current=null;setSession(null);notify('演奏结束');}
      },
    });
  }
  async function fullScreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{notify('可继续横屏演奏');}}
  const rows=measure?.layout?.rows||2,low=measure?.layout?.low||startOctave;
  const registers=rows===1?[3,4,5,6]:rows===2?[3,4,5]:[3,4];
  const cueRemaining=session?(session.events[Math.max(0,session.index-1)]?.time??0)-(session.tick?.elapsed??-1000):1000;
  const lastRegion=session&&session.kind!=='follow'&&session.target&&unsupportedPitches([{midi:session.target}]).length?'未设音位':last?(last.region==='left'?'左侧鼓':last.region==='right'?'右侧鼓':'正鼓'):'';
  const soundingNote=session&&session.kind!=='follow'&&session.target?noteName(session.target):last?.name;
  const scoreSong=songs.find(song=>song.id===scoreSongId)||songs[0],split=workspaceSplit(workspaceWidth,splitFraction);
  const scoreEventIndex=session?.item?.id===scoreSong?.id?(session.sections?.[session.sectionIndex]?.offset||0)+Math.max(0,session.index-1):null;
  const scoreProps={song:scoreSong,eventIndex:scoreEventIndex,following:followingScore,onFollowing:setFollowingScore,manualBar,onBar:setManualBar};
  function navigation(className){return h('nav',{className,'aria-label':'主导航'},[['play','钟','演奏'],['library','谱','乐谱'],['works','曲','我的']].map(([key,mark,label])=>h('button',{key,className:view===key?'selected':'','aria-current':view===key?'page':undefined,onClick:()=>changeView(key)},h('span',{className:'nav-mark'},mark),h('span',null,label))));}
  return h('main',{className:`prototype${session?' has-session':''}${view==='play'&&showScore?' has-score':''}`,'data-view':view,'data-mode':view==='observe'?'observe':'play','data-screen-label':view==='observe'?'单钟观赏':'一鸣千年'},
    h('header',{className:'topbar'},
      view==='observe'?h('button',{className:'icon-button','aria-label':'返回演奏',onClick:()=>changeView('play')},h(Icon,{name:'back'})):null,
      h('div',{className:'brand'},h('span',{className:'eyebrow'},view==='observe'?'器物细观':session?(session.kind==='follow'?'跟着敲':session.kind==='work'?'作品回放':'听一遍'):'数字编钟演奏'),h('strong',null,view==='observe'?'一钟，见千年':session?.title||'一鸣千年')),
      view!=='observe'&&navigation('top-navigation'),h('div',{className:'toolbar-spacer'}),
      session&&h('div',{className:'session-strip','aria-label':session.kind==='follow'?'跟奏提示':'播放进度'},
        session.kind!=='work'&&h('div',{className:'beat-meter','aria-label':session.paused?'已暂停':session.tick?.countIn?`预备 ${session.tick.countIn}`:`第 ${(session.tick?.beat??0)+1} 拍`},[0,1,2,3].map(i=>h('i',{key:i,className:!session.paused&&!session.done&&session.tick?.beat===i?'current':''}))),
        h('span',{className:'session-status'},session.done?'本段完成':session.paused?'已暂停':session.kind!=='follow'?'回放中':session.tick?.countIn?`预备 ${session.tick.countIn}`:cueRemaining<=65&&cueRemaining>=-180?'落槌':'下一音'),
        h('div',{className:'upcoming-notes',style:{'--cue-progress':Math.max(0,Math.min(1,1-cueRemaining/350))}},session.events.slice(Math.max(0,session.index-1),Math.max(0,session.index-1)+4).map((e,i)=>h('span',{key:`${session.index}-${i}`,className:i===0?'current':''},noteName(e.midi)))),
        session.sections?.length>1&&h('small',{className:'section-number'},`${session.sectionIndex+1}/${session.sections.length} 段`)),
      h('div',{className:'top-actions'},view!=='observe'&&!session&&h('button',{className:'quiet-button observe-entry','aria-label':'观赏编钟',onClick:()=>changeView('observe')},h(Icon,{name:'eye'}),h('span',null,'观赏编钟')),
        view==='play'&&h('button',{className:'icon-button score-toggle','aria-label':showScore?'收起对照曲谱':'显示对照曲谱','aria-pressed':showScore,onClick:toggleScore},h(Icon,{name:'book'})),
        supportsFullscreen(document)&&h('button',{className:'icon-button fullscreen-button','aria-label':'切换全屏',onClick:fullScreen},h(Icon,{name:'expand'})),
        h('button',{className:'icon-button','aria-label':'演奏设置',onClick:()=>{pauseSession();setSettings(true);}},h(Icon,{name:'gear'})))),
    h('section',{className:`performance-workspace score-${scoreSide}`,ref:workspace,hidden:!['play','observe'].includes(view),style:{'--score-pane-width':`${split.panel}px`}},
      h('section',{className:'stage-viewport',ref:host,'aria-label':view==='observe'?'单钟观赏舞台':'编钟演奏舞台'}),
      view==='play'&&showScore&&h('div',{className:'pane-splitter',role:'separator',tabIndex:recording?-1:0,'aria-label':'调整钟区与曲谱宽度','aria-orientation':'vertical','aria-valuemin':56,'aria-valuemax':86,'aria-valuenow':Math.round(split.fraction*100),'aria-disabled':recording,onPointerDown:splitStart,onPointerMove:splitMove,onPointerUp:splitEnd,onPointerCancel:splitEnd,onLostPointerCapture:splitEnd,onKeyDown:splitKey}),
      view==='play'&&showScore&&h(ScorePanel,{...scoreProps,songs,onSong:chooseScore,side:scoreSide,onSide:swapScore,onPlay:begin})),
    !loaded&&['play','observe'].includes(view)&&h('div',{className:'load-state',role:error?'alert':'status'},error||'正在启钟…'),
    view==='play'&&h('footer',{className:'performance-footer'},
      showScore&&h(ScoreStrip,scoreProps),
      h('div',{className:'note-readout','aria-live':'polite'},h('span',{className:'note-caption'},recording?'录制中':'此刻钟音'),h('strong',null,soundingNote||(recording?'待第一声':session?.paused?'已暂停':session?.tick?.countIn?'预备':'静候落槌')),h('span',{className:'note-detail'},session?`${lastRegion?lastRegion+' · ':''}${session.index}/${session.total} · ${session.feedback}`:lastRegion?`${lastRegion} · 余韵渐歇`:'中央正鼓 · 两侧侧鼓'),h('span',{className:last?'sound-wave active':'sound-wave',key:last?.at,'aria-hidden':true},Array.from({length:7},(_,i)=>h('i',{key:i})))),
      h('div',{className:'play-controls'},h('button',{className:'quiet-button','aria-pressed':labels,onClick:()=>setLabels(!labels)},`音名 ${labels?'开':'关'}`),
        session?h('div',{className:'session-controls'},
          session.done?h('button',{className:'record-button',onClick:()=>startSection(currentSession.current,session.sectionIndex+1<session.sections.length?session.sectionIndex+1:0)},session.sectionIndex+1<session.sections.length?'下一段':'再练一次'):
            h('button',{className:'record-button','aria-label':session.paused?'继续演奏':'暂停演奏',onClick:togglePause},h(Icon,{name:session.paused?'play':'pause'}),session.paused?'继续':'暂停'),
          h('button',{className:'icon-button','aria-label':'结束演奏',onClick:stopSession},h(Icon,{name:'stop'})),
          session.kind==='follow'&&session.item?.listenEvents?.some(e=>e.velocity<.45)&&h('button',{className:'quiet-button accompaniment-toggle','aria-pressed':accompaniment,onClick:()=>setAccompaniment(!accompaniment)},`伴奏 ${accompaniment?'开':'关'}`)):
          h('button',{className:recording?'record-button is-recording':'record-button',onClick:toggleRecord},h('span',{'aria-hidden':true},recording?'■':'●'),recording?`保存 ${formatTime(elapsed)}`:'录钟曲')),
      h('div',{className:'register-switch','aria-label':'切换音组'},h('span',{className:'group-label'},'音组'),registers.map(octave=>h('button',{key:octave,className:low===octave?'selected':'','aria-label':rows===1?registerLabel(octave):`${registerLabel(octave)}至${registerLabel(octave+rows-1)}`,'aria-pressed':low===octave,disabled:!!session,onClick:()=>{setStartOctave(octave);setLast(null);}},rows===1?registerMark(octave):`${registerMark(octave)}–${registerMark(octave+rows-1)}`))),
      h('button',{className:'icon-button mute-button','aria-label':muted?'开启声音':'静音','aria-pressed':muted,onClick:()=>setMuted(!muted)},h(Icon,{name:muted?'mute':'sound'}))),
    view==='observe'&&h('footer',{className:'observation-footer'},
      h('div',{className:'viewpoints','aria-label':'观察角度'},h('button',{className:'quiet-button',onClick:()=>{setCutaway(false);engine.current?.viewFront();}},'正面'),h('button',{className:'quiet-button',onClick:()=>{setCutaway(false);engine.current?.viewSide();}},'侧面'),h('button',{className:'quiet-button',onClick:()=>{setCutaway(false);engine.current?.viewInterior();}},'看内腔'),h('button',{className:'quiet-button','aria-pressed':cutaway,onClick:()=>setCutaway(!cutaway)},'剖视')),
      h('p',{className:'observe-hint'},'拖动旋转 · 双指缩放'),
      h('div',{className:'zoom-controls'},h('button',{className:'icon-button','aria-label':'缩小模型',onClick:()=>engine.current?.zoomBy(.8)},'−'),h('button',{className:'icon-button','aria-label':'放大模型',onClick:()=>engine.current?.zoomBy(1.25)},'+'),h('button',{className:'icon-button','aria-label':'重置视角',onClick:()=>engine.current?.resetCamera()},h(Icon,{name:'reset'})))),
    view==='library'&&h('section',{className:'content-page','data-screen-label':'乐谱'},h('div',{className:'page-heading'},h('p',{className:'eyebrow'},'熟悉的旋律，新的余韵'),h('h1',null,'听一遍，再从容跟奏'),h('p',null,'选一首曲子，从亮起的击点开始。')),
      h('div',{className:'filters','aria-label':'曲目分类'},['全部','入门','民间','熟悉旋律','流行'].map(x=>h('button',{key:x,className:filter===x?'selected':'','aria-pressed':filter===x,onClick:()=>setFilter(x)},x))),
      h('div',{className:'song-list'},songs.filter(s=>filter==='全部'||s.category===filter).map((song,i)=>h('article',{className:'song-row',key:song.id},h('span',{className:'song-number'},String(i+1).padStart(2,'0')),h('button',{className:'song-copy',onClick:()=>setSelected(song)},h('strong',null,song.title),h('span',null,`${song.category} · ${formatTime(song.durationMs)} · ${song.bpm} BPM${song.transcriptionStatus?' · 初稿':''}${followWarning(song)?' · 含未设音位，仅试听':''}`)),h('span',{className:'song-difficulty','aria-label':`难度 ${song.difficulty}`},'·'.repeat(song.difficulty)),h('button',{className:'row-action','aria-label':`试听${song.title}`,onClick:()=>begin(song,'listen')},h(Icon,{name:'play'})),h('button',{className:'row-action follow-action',disabled:!!followWarning(song),title:followWarning(song),onClick:()=>begin(song,'follow')},'跟着敲'))))),
    view==='works'&&h('section',{className:'content-page','data-screen-label':'我的钟曲'},h('div',{className:'page-heading'},h('p',{className:'eyebrow'},'留下一段金石之声'),h('h1',null,'我的钟曲'),h('p',null,`${works.length} 首本地作品 · 最多保留 30 首`)),
      works.length?h('div',{className:'song-list'},works.map((work,i)=>h('article',{className:'song-row',key:work.id},h('span',{className:'song-number'},String(i+1).padStart(2,'0')),h('div',{className:'song-copy'},h('strong',null,work.title),h('span',null,`${formatTime(work.durationMs)} · ${work.events.length} 次落槌`)),h('button',{className:'row-action work-play','aria-label':`播放${work.title}`,onClick:()=>begin(work,'work')},h(Icon,{name:'play'}),'播放')))):
      h('div',{className:'empty-works'},h('span',{className:'empty-mark'},'曲'),h('h2',null,'第一声，也是一首曲的开始'),h('p',null,'回到演奏，点「录钟曲」留住刚才的灵感。'),h('button',{className:'primary-button',onClick:()=>changeView('play')},'去敲一曲'))),
    view!=='observe'&&navigation('bottom-navigation'),
      h('dialog',{ref:dialog,className:'settings-dialog',onCancel:()=>setSettings(false)},h('header',null,h('h2',null,'演奏设置'),h('button',{className:'icon-button','aria-label':'关闭设置',onClick:()=>setSettings(false)},h(Icon,{name:'close'}))),h('label',{className:'setting-row'},'舞台布局',h('select',{'aria-label':'舞台布局',value:choice,disabled:!!session,onChange:e=>setChoice(e.target.value)},h('option',{value:'auto'},'双音组优先'),h('option',{value:'single'},'单音组聚焦'),h('option',{value:'full'},'三音组整架'))),h('label',{className:'setting-row'},'跟奏速度',h('select',{'aria-label':'跟奏速度',value:followRate,disabled:!!session,onChange:e=>setFollowRate(Number(e.target.value))},[.6,.72,.9,1].map(rate=>h('option',{key:rate,value:rate},`${Math.round(rate*100)}%`)))),h('label',{className:'setting-row'},'对照曲谱',h('select',{'aria-label':'手机对照曲谱',value:scoreSongId,disabled:!!session,onChange:e=>chooseScore(e.target.value)},songs.map(song=>h('option',{key:song.id,value:song.id},song.title)))),h('label',{className:'setting-row'},h('span',null,'显示触控区域'),h('input',{type:'checkbox',checked:diagnostics,onChange:e=>setDiagnostics(e.target.checked)})),h('p',{className:'settings-note'},'每音组七口钟，正鼓 c–b；按空间显示 7、14 或 21 口，竖屏分行但不减钟。图中 c/e、d/f、g/b、a/下一组 c 保留；e/e、f/♯f、b/b 沿用原配对。音名只控制显示。')),
    selected&&h('dialog',{className:selected.transcriptionStatus?'song-detail has-recording-score':'song-detail',ref:details,'aria-label':selected.title,onCancel:()=>setSelected(null)},h('div',{className:'song-detail-panel'},h('button',{className:'icon-button detail-close','aria-label':'关闭曲目',onClick:()=>setSelected(null)},h(Icon,{name:'close'})),h('p',{className:'eyebrow'},selected.transcriptionStatus?'录音转谱初稿':selected.category),h('h2',null,selected.title),h('p',null,selected.description),selected.scoreCredit&&h('p',{className:'score-credit'},selected.scoreCredit),
      selected.transcriptionStatus?h(RecordingScore,{song:selected}):selected.jianpuBars?h('div',{className:'jianpu-score','aria-label':'竹枝词主题简谱，八小节'},h('p',null,'1=C · 4/4 · 慢速'),h('div',{className:'jianpu-bars'},selected.jianpuBars.map((bar,i)=>h('div',{className:'jianpu-bar',key:i,'aria-label':`第 ${i+1} 小节`},bar.map((n,j)=>h('span',{key:j,className:`jianpu-note ${n.octave===-1?'low-note':''} ${n.duration<1?'short-note':''} ${n.duration===.25?'sixteenth':''}`},n.degree,n.duration===.75||n.duration===1.5?'·':'',n.duration===2?h('i',null,'−'):null)))))):
      h('div',{className:'score-preview','aria-label':'旋律音符'},selected.events.slice(0,32).map((e,i)=>h('span',{key:i},noteName(e.midi)))),followWarning(selected)&&h('p',{className:'score-warning'},followWarning(selected)),h('div',{className:'detail-actions'},h('button',{className:'secondary-button',onClick:()=>begin(selected,'listen')},'听一遍'),h('button',{className:'primary-button',disabled:!!followWarning(selected),title:followWarning(selected),onClick:()=>begin(selected,'follow')},'跟着敲'),h('button',{className:'quiet-button read-score-action',onClick:()=>{chooseScore(selected.id);setShowScore(true);setSelected(null);changeView('play');}},'看谱自由演奏')))),
    toast&&h('div',{className:'toast',role:'status'},toast));
}
window.ReactDOM.createRoot(document.getElementById('root')).render(h(App));
