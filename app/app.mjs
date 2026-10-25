import {t,tr,getLocale,setLocale} from './i18n.mjs';
import {BellAudio,readVolume,VOLUME_KEY,activateSoundOnInteraction} from './audio.mjs';
import {PerformanceScene} from './performance.mjs';
import {performanceContact} from './performance-layout.mjs';
import {Transport,scoreEvents,readWorks,saveWorks,formatTime} from './session.mjs';
import {observeViewport,supportsFullscreen} from './mobile-viewport.mjs';
import {initialView} from './home-interaction.mjs';
import {appendStrike,recordedWork,workTitle,renameWork} from './recording-model.mjs';
import {clampSplitFraction} from './score-workspace.mjs';
import {pitchLabel,pitchFitsBank,isPairedPitch,registerLabel,unsupportedPitches} from './paired-instrument.mjs';
import {measuresFor,practiceBank,practiceHit,phraseEvents} from './practice-model.mjs';
import {Home2DScene} from './home-2d-scene.mjs';
import {ModelResource,mountModel} from './model-resource.mjs';
import {Header,Icon,HomeTitle,HomeGuide,HomeStudy,ModelModeControl,ScoreAside,PhraseStrip,BankPicker,LibraryPage,ObservePanel,WorksPage} from './components.mjs';

const {createElement:h,useState,useEffect,useRef}=window.React;
const songs=window.YMQNSongs||[];
const defaultSong=songs.find(s=>s.id==='zhuzhi-ci')||songs[0];
const deepView=location.hash.slice(1);
const simulated=new URLSearchParams(location.search).get('safe');
if(simulated){
  const values=simulated.split(',').map(Number),sides=values.length===3?['left','right','bottom']:['top','left','right','bottom'];
  if([3,4].includes(values.length)&&values.every(Number.isFinite))sides.forEach((side,i)=>document.documentElement.style.setProperty(`--safe-${side}`,`${Math.max(0,Math.min(96,values[i]))}px`));
}
const linkedSong=new URLSearchParams(location.search).get('score');
const initial={view:['home','play','library','observe','works'].includes(deepView)?deepView:initialView(location.search),songId:songs.some(s=>s.id===linkedSong)?linkedSong:defaultSong.id,bar:0,index:0,phase:'free',mode:'wait',paused:false,feedback:t('先听一遍，再试着敲一句。'),low:4,labels:true,muted:false,workTitle:'',accompaniment:true,rate:.72};

function App(){
  const [language,setLanguage]=useState(getLocale);
  const [state,setState]=useState(initial),[heard,setHeard]=useState({center:false,side:false}),[homeLast,setHomeLast]=useState(null),[theme,setTheme]=useState('relief');
  const [homeReady,setHomeReady]=useState(false),[layout,setLayout]=useState({rows:2,low:4,count:8}),[lastNote,setLastNote]=useState(null),[focused,setFocused]=useState(false);
  const [modelEnabled,setModelEnabled]=useState(false),[modelState,setModelState]=useState('off'),[modelAttempt,setModelAttempt]=useState(0);
  const posterHost=useRef(null),poster=useRef(null),modelResource=useRef(null);
  if(!modelResource.current)modelResource.current=new ModelResource();
  const [filter,setFilter]=useState('全部'),[settings,setSettings]=useState(false),[part,setPart]=useState('overview'),[cut,setCut]=useState(false);
  const [arrivalAudio,setArrivalAudio]=useState('pending'),[works,setWorks]=useState(readWorks),[recording,setRecording]=useState(false),[elapsed,setElapsed]=useState(0),[recordCount,setRecordCount]=useState(0),[notice,setNotice]=useState('');
  const [scoreSide,setScoreSide]=useState('right'),[showScore,setShowScore]=useState(true),[splitFraction,setSplitFraction]=useState(.72);
  const [volume,setVolume]=useState(readVolume),[workEdit,setWorkEdit]=useState(null);
  const [homeMore,setHomeMore]=useState(false),noteStyle='classic';
  const partLive=useRef(part);partLive.current=part;
  const homeMoreDialog=useRef(null);
  const workDialog=useRef(null),workNameInput=useRef(null);
  const splitDrag=useRef(null),workspace=useRef(null);
  const playbackTicket=useRef(0),pendingPlayback=useRef(null);
  const live=useRef(state),heardLive=useRef(heard),audio=useRef(),transport=useRef(),engine=useRef(null),viewer=useRef(null),homeHost=useRef(null),playHost=useRef(null),hint=useRef(null),introSeen=useRef(false),settingsDialog=useRef(null),record=useRef(null),workList=useRef(works),noticeTimer=useRef();
  live.current=state;heardLive.current=heard;
  workList.current=works;
  if(!audio.current)audio.current=new BellAudio();if(!transport.current)transport.current=new Transport();
  const song=songs.find(x=>x.id===state.songId)||defaultSong,measures=measuresFor(song),measure=measures[state.bar]||measures[0];
  const playable=unsupportedPitches(song.events).length===0;
  const active=['wait','listen','timed'].includes(state.phase),target=active?measure.notes[state.index]:null;

  function changeLanguage(){
    if(hint.current)hint.current.hidden=true;
    pause('language');setLocale(language==='en'?'zh':'en');setLanguage(getLocale());setNotice('');clearTimeout(noticeTimer.current);
    setWorkEdit(edit=>edit?{...edit,error:''}:null);update({feedback:t('语言已切换，当前乐句已保留。')});
  }
  function update(values){setState(s=>({...s,...values}));}
  function notify(text){setNotice(text);clearTimeout(noticeTimer.current);noticeTimer.current=setTimeout(()=>setNotice(''),4200);}
  function stop(){playbackTicket.current++;pendingPlayback.current=null;transport.current.stop();audio.current.suspend();engine.current?.setTarget(null);}
  function playStage(events,options){
    const ticket=++playbackTicket.current;
    const run=scene=>scene.ready.then(()=>{
      if(ticket!==playbackTicket.current||engine.current!==scene||live.current.view!=='play')return;
      transport.current.play(events,options);if(live.current.paused)transport.current.pause();
    }).catch(()=>notify(t('钟体素材暂未就绪，请刷新页面重试。')));
    if(engine.current)run(engine.current);else pendingPlayback.current=run;
  }
  function persistWorks(next,message){workList.current=next;setWorks(next);notify(saveWorks(next)?message:t('设备保存失败，钟曲暂留在本页内存中，请在「我的」重试保存。'));}
  function finishRecording(requestName=false){
    if(!record.current)return;
    const work=recordedWork(record.current,workList.current.length);record.current=null;setRecording(false);setElapsed(0);setRecordCount(0);
    if(!work){notify(t('尚未落槌，没有保存空钟曲。'));return;}
    if(requestName){setWorkEdit({kind:'new',work,value:work.title,error:''});return;}
    persistWorks([work,...workList.current].slice(0,30),t('已保存到「我的」。'));
  }
  function commitWorkName(event){
    event?.preventDefault();const title=workTitle(workEdit?.value);
    if(!title){setWorkEdit(edit=>({...edit,error:t('请输入曲名。')}));return;}
    const next=workEdit.kind==='new'?[{...workEdit.work,title},...workList.current].slice(0,30):renameWork(workList.current,workEdit.work.id,title);
    persistWorks(next,workEdit.kind==='new'?t('已保存到「我的」。'):t('曲名已修改。'));setWorkEdit(null);
  }
  function closeWorkName(){
    if(workEdit?.kind==='new')persistWorks([workEdit.work,...workList.current].slice(0,30),t('已保留默认曲名，可在「我的」修改。'));
    setWorkEdit(null);
  }
  function toggleRecord(){
    if(record.current){finishRecording(true);return;}
    if(workList.current.length>=30){notify(t('已保存 30 首钟曲。'));return;}
    stop();audio.current.unlock().catch(()=>notify(t('请再轻敲钟面开启声音。')));record.current={first:null,events:[]};setRecordCount(0);setElapsed(0);setRecording(true);update({phase:'free',paused:false,feedback:t('正在录制，敲下第一声开始计时。')});
  }
  function changeView(view){if(view===live.current.view)return;stop();finishRecording();setSettings(false);update({view,phase:'free',paused:false,index:0,feedback:t('先听一遍，再试着敲一句。'),workTitle:''});location.hash=view;}
  function selectSong(next,bar=0,phase='free'){
    stop();finishRecording();const m=measuresFor(next)[bar],bank=practiceBank(m.notes,layout.rows||2);
    update({songId:next.id,bar,index:0,phase,paused:false,low:bank.low,feedback:phase==='wait'?tr`先找简谱 ${m.notes[0].degree} · ${pitchLabel(m.notes[0].midi)}`:t('轻点谱音可以先听，找到后再敲钟。')});
  }
  function unavailableScore(next){
    const missing=unsupportedPitches(next.events);if(!missing.length)return false;
    notify(tr`待补音：${missing.map(pitchLabel).join('、')}。四钟音组暂不支持整曲试听与跟奏。`);return true;
  }
  function start(next=song,bar=state.bar){
    if(unavailableScore(next))return;
    const m=measuresFor(next)[bar],bank=practiceBank(m.notes,layout.rows||2);
    if(m.notes.some(n=>!isPairedPitch(n.midi))||!bank.fits&&state.mode==='timed'){
      selectSong(next,bar);update({view:'play',feedback:t('这一小节超出当前击点范围。可先试听，或切换为等待式分段练习。')});return;
    }
    selectSong(next,bar,state.mode==='timed'?'timed':'wait');update({view:'play'});location.hash='play';
    if(state.mode==='timed')runTimed(next,bar);
  }
  function startFirst(){start(defaultSong,0);}
  function setBar(index){if(index<0||index>=measures.length)return;selectSong(song,index);}
  function nextBar(){if(state.bar+1<measures.length)start(song,state.bar+1);else start(song,0);}
  function pause(reason){
    const current=live.current;if(!['wait','listen','timed','work'].includes(current.phase)||current.paused)return;
    transport.current.pause();audio.current.suspend();update({paused:true,feedback:reason==='resize'?t('布局已调整。继续时从当前音接着敲。'):t('已暂停，当前乐句与位置已保留。')});
  }
  function togglePause(){
    if(state.paused){audio.current.unlock().catch(()=>{});if(state.phase!=='wait')transport.current.resume();update({paused:false,feedback:state.phase==='wait'?t('接着敲亮起的击点。'):t('继续演奏。')});}
    else pause('manual');
  }
  function handleStrike(event){
    const current=live.current;setLastNote(event);
    if(appendStrike(record.current,event))setRecordCount(record.current.events.length);
    if(['playback','score-preview'].includes(event.source))return;
    if(current.phase==='wait'){
      const currentSong=songs.find(x=>x.id===current.songId),notes=measuresFor(currentSong)[current.bar].notes;
      const result=practiceHit({index:current.index,notes,phase:current.phase,paused:current.paused},event.midi);
      if(current.paused)return;
      if(result.accepted)update({index:result.index,phase:result.done?'done':'wait',feedback:result.done?t('这一句敲完了。可以继续，也可以再练一次。'):tr`敲对了，接着找 ${pitchLabel(notes[result.index].midi)}。`});
      else update({feedback:tr`刚才是 ${pitchLabel(event.midi)}，再试试亮起的 ${pitchLabel(notes[current.index].midi)}。`});
    }else if(current.phase==='timed'&&!current.paused){
      const correct=transport.current.judge(event.midi,performance.now());update({feedback:correct?t('对上拍点了。'):t('再听听拍点，继续下一音。')});
    }else if(current.phase==='free'&&!record.current)update({feedback:tr`${pitchLabel(event.midi)} · ${event.region==='center'?t('中央正鼓'):t('侧鼓')} · 余韵渐歇`});
  }
  function listenPhrase(){
    if(unavailableScore(song))return;
    stop();finishRecording();audio.current.unlock().catch(()=>{});update({phase:'listen',paused:false,index:0,feedback:t('正在示范这一句，留意亮起的击点。')});
    const events=phraseEvents(measure.notes,song.bpm);
    playStage(events,{beatMs:60000/song.bpm,onNote:(e,i)=>{fitPlaybackNote(e.midi,measure.notes);engine.current?.strikeMidi(e.midi,'playback');update({index:i});},onEnd:()=>update({phase:'free',index:0,feedback:t('听过这一句了，试着跟着敲。')})});
  }
  function fitPlaybackNote(midi,notes){
    const scene=engine.current,rows=scene?.layout?.rows||2,low=scene?.layout?.low??live.current.low;
    if(pitchFitsBank(midi,low,rows))return;
    const whole=practiceBank(notes,rows),bank=whole.fits?whole:practiceBank([{midi}],rows);
    scene?.setOptions({startOctave:bank.low});update({low:bank.low});
  }
  function listenSong(next){
    if(unavailableScore(next))return;
    stop();finishRecording();audio.current.unlock().catch(()=>{});const ms=measuresFor(next),bank=practiceBank(ms[0].notes,layout.rows||2);
    update({view:'play',songId:next.id,bar:0,index:0,low:bank.low,phase:'listen',paused:false,feedback:next.transcriptionStatus?t('正在试听转谱初稿。＊处仍待听校。'):t('正在示范，留意钟上的击点。')});location.hash='play';
    const events=scoreEvents(next);
    playStage(events,{beatMs:60000/next.bpm,endTime:next.durationMs,accompaniment:state.accompaniment?scoreEvents(next,1,(next.listenEvents||[]).filter(e=>e.velocity<.45)):[],onAccompaniment:e=>audio.current.strike(e.midi,0,e.velocity).catch(()=>{}),onNote:(e,i)=>{
      const original=next.events[i],bar=ms.findIndex(m=>m.notes.some(n=>n.midi===original.midi&&Math.abs(n.beat-original.beat)<.001));
      const currentBar=Math.max(0,bar),at=ms[currentBar].notes.findIndex(n=>n.midi===original.midi&&Math.abs(n.beat-original.beat)<.001),current=live.current;
      if(current.bar!==currentBar)update({bar:currentBar});
      fitPlaybackNote(e.midi,ms[currentBar].notes);
      engine.current?.strikeMidi(e.midi,'playback',e.velocity);update({index:Math.max(0,at)});
    },onEnd:()=>update({phase:'free',index:0,feedback:t('试听结束。选一小句，慢慢敲一遍。')})});
  }
  function runTimed(next,bar){
    const notes=measuresFor(next)[bar].notes,rate=state.rate,events=phraseEvents(notes,next.bpm*rate,next.bpm);
    audio.current.unlock().catch(()=>{});
    playStage(events,{follow:true,beatMs:60000/next.bpm/rate,onTarget:(e,i)=>{engine.current?.setCue(200);update({index:i,feedback:tr`跟着拍点，敲 ${pitchLabel(e.midi)}。`});},onTick:tick=>{if(tick.countIn)update({feedback:tr`预备 ${tick.countIn} · 听拍点，准备落槌。`});},onEnd:()=>update({phase:'done',index:notes.length,feedback:t('这一句已结束。可以再练一次，或继续下一句。')})});
  }
  function audition(midi){audio.current.strike(midi).catch(()=>update({feedback:t('声音尚未开启，请再轻点一次。')}));}
  function homeTone(region){if(homeReady&&viewer.current?.mesh)viewer.current.strike(region);else if(poster.current)poster.current.strike(region);else{audition(region==='center'?60:64);homeStrike({region,midi:region==='center'?60:64});}}
  function homeStrike(event){setHomeLast(event);setHeard(s=>({...s,[event.region==='center'?'center':'side']:true}));}
  async function replayArrival(){
    if(hint.current)hint.current.hidden=true;
    update({muted:false});audio.current.setMuted(false);
    const scene=homeReady?viewer.current:poster.current;setArrivalAudio('pending');
    try{await audio.current.unlock();}catch{setArrivalAudio('blocked');notify(t('声音暂未开启，请检查浏览器声音设置。'));}
    finally{scene?.replayArrival();}
  }
  function playWork(work){
    stop();finishRecording();audio.current.unlock().catch(()=>{});
    if(unsupportedPitches(work.events).length)notify(t('旧录曲按原音高回放，当前钟架未设置的音只发声，不显示击点。'));
    const bank=practiceBank(work.events,layout.rows||2);update({view:'play',phase:'work',paused:false,low:bank.low,workTitle:work.title,feedback:tr`正在回放 ${work.title}`});location.hash='play';
    playStage(scoreEvents(work),{endTime:work.durationMs,onNote:e=>{
      if(!pitchFitsBank(e.midi,engine.current?.layout.low||live.current.low,engine.current?.layout.rows||2)){
        const next=practiceBank([e],engine.current?.layout.rows||2);engine.current?.setOptions({startOctave:next.low});update({low:next.low});
      }
      engine.current?.strikeMidi(e.midi,'playback',e.velocity,e.region,e.bellId);
    },onEnd:()=>update({phase:'free',workTitle:'',feedback:t('作品回放结束。')})});
  }
  function interrupt(reason){if(record.current)finishRecording();pause(reason);}
  async function fullScreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{notify(t('当前浏览器可继续横屏演奏。'));}}
  function splitStart(event){
    if(record.current||event.button!==0)return;event.preventDefault();pause('resize');engine.current?.cancelInput(true);
    event.currentTarget.setPointerCapture(event.pointerId);splitDrag.current=event.pointerId;
  }
  function splitMove(event){
    if(splitDrag.current!==event.pointerId)return;
    const bounds=workspace.current.getBoundingClientRect(),fraction=(event.clientX-bounds.left)/bounds.width;
    setSplitFraction(clampSplitFraction(scoreSide==='right'?fraction:1-fraction));
  }
  function splitEnd(event){if(splitDrag.current!==event.pointerId)return;splitDrag.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}
  function splitKey(event){
    if(record.current||!['ArrowLeft','ArrowRight','Home'].includes(event.key))return;event.preventDefault();pause('resize');
    setSplitFraction(value=>event.key==='Home'?.72:clampSplitFraction(value+(event.key==='ArrowRight'?1:-1)*(scoreSide==='right'?1:-1)*.025));
  }

  function projectHome(scene){
    const mark=hint.current;if(!mark||live.current.view!=='home')return;
    if(scene.arriving){mark.hidden=true;return;}
    const seen=heardLive.current,region=!seen.center?'center':!seen.side?'left':null;
    mark.hidden=!region||!!scene.camera&&scene.camera.position.z<0;if(!region)return;
    const point=scene.strikeProjection(region);mark.style.left=`${point.x}px`;mark.style.top=`${point.y}px`;mark.textContent=region==='center'?t('轻敲中央'):t('再试侧边');
  }
  useEffect(()=>{
    const type=state.view;if(!['home','observe'].includes(type))return;
    const scene=new Home2DScene(posterHost.current,{audio:audio.current,purpose:type==='home'?'audition':'inspect',intro:type==='home'&&!introSeen.current,onStrike:homeStrike,onInspect:id=>setPart(id),onProject:projectHome,onArrivalAudio:setArrivalAudio});
    poster.current=scene;if(type==='home')introSeen.current=true;if(type==='observe')scene.setPart(partLive.current);
    return()=>{scene.dispose();poster.current=null;};
  },[state.view]);
  useEffect(()=>{
    setHomeReady(false);setCut(false);viewer.current=null;
    if(!modelEnabled){modelResource.current.cancel();setModelState('off');return;}
    setModelState('loading');
    if(!['home','observe'].includes(state.view)){
      let cancelled=false;modelResource.current.load().catch(()=>{if(!cancelled)setModelState('error');});
      return()=>{cancelled=true;};
    }
    const type=state.view;
    const attempt=mountModel({host:homeHost.current,resource:modelResource.current,
      createScene:(HomeBellScene,bytes,onError)=>new HomeBellScene(homeHost.current,{audio:audio.current,bytes,onError,purpose:type==='home'?'audition':'inspect',intro:false,onStrike:homeStrike,onContext:ready=>{if(!ready)onError(new Error('WebGL context lost'));},onInspect:id=>setPart(id),onArrivalAudio:setArrivalAudio,onProject:projectHome}),
      onState:(status,scene)=>{
        setModelState(status);setHomeReady(status==='ready');viewer.current=scene||null;poster.current?.setVisible(status!=='ready');
        if(scene){scene.setInteractive(true);if(type==='observe')scene.selectPart(partLive.current,true);}
      },
    });
    return()=>{attempt.dispose();viewer.current=null;poster.current?.setVisible(true);};
  },[modelEnabled,modelAttempt,state.view]);
  useEffect(()=>{poster.current?.setPart(state.view==='observe'?part:theme==='cavity'?'cavity':'overview');},[part,theme,state.view]);
  useEffect(()=>{
    if(state.view!=='play')return;
    const scene=new PerformanceScene(playHost.current,{audio:audio.current,onStrike:handleStrike,onMessage:text=>update({feedback:text}),onInterrupt:interrupt,onMeasure:info=>{
      if(!info.layout)return;const next={rows:info.layout.rows,low:info.layout.low,count:info.bellCount,key:`${info.layout.width}:${info.layout.height}:${info.layout.portrait}`};
      setLayout(old=>old.rows===next.rows&&old.low===next.low&&old.count===next.count&&old.key===next.key?old:next);
    }});engine.current=scene;
    scene.setOptions({startOctave:live.current.low,choice:focused?'single':'auto',labels:live.current.labels,muted:live.current.muted,active:true,noteStyle});
    scene.ready.catch(()=>update({feedback:t('钟体素材暂未就绪，可以刷新页面后重试。')}));
    scene.ready.then(()=>{const run=pendingPlayback.current;pendingPlayback.current=null;run?.(scene);}).catch(()=>{});
    return()=>{scene.dispose();engine.current=null;};
  },[state.view]);
  useEffect(()=>{engine.current?.setOptions({startOctave:state.low,choice:focused?'single':'auto',labels:state.labels,muted:state.muted,focusTarget:active});engine.current?.setTarget(target?.midi??null);engine.current?.setCue(350);},[state.low,state.labels,state.muted,state.phase,state.index,state.bar,state.paused,layout.count,focused]);
  useEffect(()=>{engine.current?.setOptions({noteStyle,locale:language});viewer.current?.refreshLanguage();poster.current?.refreshLanguage();},[noteStyle,language]);
  useEffect(()=>{const d=homeMoreDialog.current;if(homeMore&&!d.open)d.showModal();else if(!homeMore&&d.open)d.close();},[homeMore]);
  useEffect(()=>{audio.current.setMuted(state.muted);},[state.muted]);
  useEffect(()=>activateSoundOnInteraction(audio.current,document,()=>!live.current.muted&&!document.hidden),[]);
  useEffect(()=>{audio.current.setVolume(volume);try{localStorage.setItem(VOLUME_KEY,String(volume));}catch{}},[volume]);
  useEffect(()=>{
    const unobserve=observeViewport(window,document.documentElement),onHide=()=>{if(document.hidden){interrupt('hidden');audio.current.suspend();}},onBlur=()=>interrupt('blur');
    const onHash=()=>{const next=location.hash.slice(1)||initialView(location.search);if(['home','play','library','observe','works'].includes(next)&&next!==live.current.view)changeView(next);};
    document.addEventListener('visibilitychange',onHide);window.addEventListener('blur',onBlur);window.addEventListener('hashchange',onHash);
    return()=>{unobserve();document.removeEventListener('visibilitychange',onHide);window.removeEventListener('blur',onBlur);window.removeEventListener('hashchange',onHash);};
  },[]);
  useEffect(()=>{if(!recording)return;const timer=setInterval(()=>{if(record.current&&record.current.first!==null){const length=performance.now()-record.current.first;setElapsed(length);if(length>=300000)finishRecording();}},200);return()=>clearInterval(timer);},[recording]);
  useEffect(()=>{const dialog=settingsDialog.current;if(settings&&!dialog.open)dialog.showModal();else if(!settings&&dialog.open)dialog.close();},[settings]);
  useEffect(()=>{const dialog=workDialog.current;if(workEdit&&!dialog.open){dialog.showModal();requestAnimationFrame(()=>workNameInput.current?.select());}else if(!workEdit&&dialog.open)dialog.close();},[!!workEdit]);
  useEffect(()=>()=>{modelResource.current.cancel();transport.current.stop();audio.current.dispose();clearTimeout(noticeTimer.current);},[]);

  const contact=target&&engine.current?.layout?performanceContact(engine.current.layout,target.midi):null;
  const needsBank=target&&!pitchFitsBank(target.midi,layout.low,layout.rows),targetBank=target?practiceBank([target],layout.rows).low:state.low;
  const stageTag=contact?{left:Math.max(52,Math.min((engine.current.layout.width||500)-52,contact.point.x)),top:Math.max(20,contact.point.y-35)}:null;
  function selectPart(id){setPart(id);setCut(false);viewer.current?.setCutaway(false);viewer.current?.selectPart(id,true);}
  function observeTheme(key){setTheme(key);if(key==='cavity')selectPart('cavity');else if(key==='relief')selectPart('zhuan');else selectPart('overview');}
  function observeView(key){if(key==='front')viewer.current?.reset();if(key==='side')viewer.current?.viewSide();if(key==='cavity')observeTheme('cavity');}
  const modelControl=h(ModelModeControl,{enabled:modelEnabled,status:modelState,onChange:setModelEnabled,onRetry:()=>{setModelEnabled(true);setModelAttempt(value=>value+1);}});
  const bankDisabled=recording||['listen','timed','work'].includes(state.phase);
  const focusControl=h('button',{className:'text-button focus-register','aria-pressed':focused,disabled:bankDisabled,onClick:()=>{interrupt('resize');setFocused(value=>!value);}},focused?t('展开音组'):t('聚焦一排'));
  const playControls=h(window.React.Fragment,null,h(BankPicker,{low:layout.low,rows:layout.rows,onBank:low=>update({low}),disabled:bankDisabled}),focusControl);

  return h('main',{className:`bell-app view-${state.view}`,'data-view':state.view,'data-phase':state.phase,'data-paused':state.paused,'data-step':state.index,'data-recording':recording,'data-work-count':works.length},
    h(Header,{view:state.view,playControls,modelControl:['home','observe'].includes(state.view)?modelControl:null,onLanguage:changeLanguage,onView:changeView,onMore:()=>setHomeMore(true),onSettings:()=>{interrupt('settings');setSettings(true);},context:state.workTitle||`${t(song.title)} · ${state.bar+1}/${measures.length}`,feedback:recording?tr`录制中 · ${formatTime(elapsed)} · ${recordCount} 次落槌`:state.paused?t('已暂停 · 继续时接着敲'):state.feedback}),
    state.view==='home'&&h('section',{className:'home-screen','data-screen-label':t('双音入门首页')},
      h('div',{className:'home-hall','aria-hidden':true}),h('div',{className:'home-layout'},h(HomeTitle),
        h('div',{className:'home-object','data-ready':homeReady,'data-model-state':modelState,'data-render-mode':homeReady?'3d':'2d'},h('div',{className:'home-2d-host',ref:posterHost}),h('div',{className:'home-canvas-host',ref:homeHost,'data-visible':homeReady})),
        h(HomeGuide,{heard,last:homeLast,threeD:homeReady,onTone:homeTone,onStart:startFirst,onFree:()=>changeView('play'),onObserve:()=>{setPart('overview');changeView('observe');}}),
        h(HomeStudy,{theme,onTheme:setTheme,onZoom:n=>viewer.current?.zoomBy(n),onReset:()=>viewer.current?.reset(),onObserve:()=>{setPart('overview');changeView('observe');},ready:homeReady,arrivalAudio,onArrival:replayArrival,volume,onVolume:setVolume})),h('span',{className:'home-hit-hint',ref:hint,hidden:true,'aria-hidden':true})),
    state.view==='play'&&h('section',{className:'play-page','data-screen-label':t('看谱与逐句跟奏')},
      h('div',{className:'play-topline'},h('div',null,h('h1',null,state.workTitle||t(song.title)),h('p',null,state.phase==='work'?t('本地作品回放'):`${t(measure.label)} · ${recording?t('录制中'):state.phase==='listen'?(state.paused?t('试听已暂停'):t('试听中')):state.phase==='wait'?t('等敲对再继续'):state.phase==='timed'?t('跟着节拍'):t('自由演奏')}${song.transcriptionStatus?t(' · 转谱初稿'):''}`)),h('div',{className:'play-layout-controls'},playControls)),
      h('div',{className:`play-workspace score-${scoreSide}${!showScore||state.phase==='work'?' score-hidden':''}`,ref:workspace,style:{'--bell-fr':`${splitFraction}fr`,'--score-fr':`${1-splitFraction}fr`}},h('section',{className:'play-stage','aria-label':t('编钟演奏区')},h('div',{className:'performance-host',ref:playHost}),target&&stageTag&&h('span',{className:'target-caption',style:stageTag,'aria-hidden':true},`${target.accidental||''}${target.degree} · ${pitchLabel(target.midi)}`),
        needsBank&&h('div',{className:'bank-shift-prompt'},h('span',null,tr`下一个音 ${pitchLabel(target.midi)} 在另一音组`),h('button',{className:'secondary',onClick:()=>update({low:targetBank})},tr`切换至${registerLabel(targetBank)}`)),h('span',{className:'stage-summary'},tr`${layout.count} 口 · 每音组四口`)),
        showScore&&state.phase!=='work'&&h('div',{className:'pane-splitter',role:'separator',tabIndex:recording?-1:0,'aria-label':t('调整钟区与曲谱宽度'),'aria-orientation':'vertical','aria-valuemin':56,'aria-valuemax':86,'aria-valuenow':Math.round(splitFraction*100),'aria-disabled':recording,onPointerDown:splitStart,onPointerMove:splitMove,onPointerUp:splitEnd,onPointerCancel:splitEnd,onLostPointerCapture:splitEnd,onKeyDown:splitKey}),
        showScore&&state.phase!=='work'&&h(ScoreAside,{song,measures,bar:state.bar,index:state.index,active,playable,onBar:setBar,onPractice:()=>start(),onListen:listenPhrase,onAudition:audition})),
      h(PhraseStrip,{measure,bar:state.bar,count:measures.length,index:state.index,phase:state.phase,paused:state.paused,feedback:state.feedback,playable,onPrev:()=>setBar(state.bar-1),onNext:()=>state.phase==='done'?nextBar():setBar(state.bar+1),onListen:listenPhrase,onPractice:()=>start(),onPause:togglePause,onStop:()=>{stop();update({phase:'free',paused:false,workTitle:'',feedback:t('已结束，当前乐句已保留。')});},onRetry:()=>start(),onAudition:audition,muted:state.muted,onMute:()=>update({muted:!state.muted}),recording,elapsed,recordCount,onRecord:toggleRecord,playback:state.phase==='work'?state.workTitle:null})),
    state.view==='library'&&h(LibraryPage,{songs,selected:song,filter,onFilter:setFilter,onSelect:next=>selectSong(next),onStart:start,onListen:listenSong,onAudition:audition,onSource:stop,onBar:(next,bar)=>{selectSong(next,bar);update({view:'play'});location.hash='play';}}),
    state.view==='works'&&h(WorksPage,{works,onPlay:playWork,onRecord:()=>changeView('play'),onRename:work=>setWorkEdit({kind:'rename',work,value:work.title,error:''}),onSave:()=>notify(saveWorks(works)?t('本地作品已保存。'):t('保存失败，请检查浏览器存储空间。'))}),
    state.view==='observe'&&h('section',{className:'observe-page home-screen','data-screen-label':t('单钟结构观赏')},
      h('div',{className:'home-object observe-object','data-ready':homeReady,'data-model-state':modelState,'data-render-mode':homeReady?'3d':'2d'},h('div',{className:'home-2d-host',ref:posterHost}),h('div',{className:'home-canvas-host',ref:homeHost,'data-visible':homeReady})),
      h(ObservePanel,{part,onPart:selectPart,theme,onTheme:observeTheme,onBack:()=>changeView('play'),onCompare:()=>changeView('home'),onView:observeView,onZoom:n=>viewer.current?.zoomBy(n),onCut:()=>{viewer.current?.setCutaway(!cut);if(!cut)viewer.current?.viewCutaway();setCut(!cut);},cut,ready:homeReady})),
    h('dialog',{className:'settings-dialog',ref:settingsDialog,onCancel:()=>setSettings(false),'aria-label':t('练习设置')},h('header',null,h('h2',null,t('练习设置')),h('button',{className:'icon-button','aria-label':t('关闭练习设置'),onClick:()=>setSettings(false)},h(Icon,{name:'close'}))),
      h('label',{className:'setting-row'},h('span',null,t('练习方式')),h('select',{'aria-label':t('练习方式'),value:state.mode,onChange:e=>{stop();update({mode:e.target.value,phase:'free',paused:false,index:0,feedback:t('练习方式已切换，准备好后开始。')});}},h('option',{value:'wait'},t('等敲对再继续')),h('option',{value:'timed'},t('跟着节拍')))),
      h('label',{className:'setting-row'},h('span',null,t('节拍练习速度')),h('select',{'aria-label':t('节拍练习速度'),value:state.rate,onChange:e=>{stop();update({rate:Number(e.target.value),phase:'free',paused:false});}},[.5,.72,.9,1].map(rate=>h('option',{key:rate,value:rate},`${Math.round(rate*100)}%`)))),
      h('label',{className:'setting-row'},h('span',null,t('试听中的参考伴奏')),h('input',{type:'checkbox',checked:state.accompaniment,onChange:e=>update({accompaniment:e.target.checked})})),
      h('label',{className:'setting-row score-setting'},h('span',null,t('桌面对照乐谱')),h('input',{type:'checkbox',checked:showScore,onChange:e=>setShowScore(e.target.checked)})),
      h('label',{className:'setting-row score-setting'},h('span',null,t('曲谱位置')),h('select',{'aria-label':t('曲谱位置'),value:scoreSide,onChange:e=>setScoreSide(e.target.value)},h('option',{value:'right'},t('右侧')),h('option',{value:'left'},t('左侧')))),
      supportsFullscreen(document)&&h('button',{className:'text-button fullscreen-control',onClick:fullScreen},t('切换全屏')),
      h('div',{className:'settings-bank-controls'},playControls),h('label',{className:'setting-row'},h('span',null,t('显示音名')),h('input',{type:'checkbox',checked:state.labels,onChange:e=>update({labels:e.target.checked})})),
      h('p',{className:'setting-note'},['listen','timed'].includes(state.phase)?t('试听按曲谱自动切换音组；节拍练习使用当前乐句的音组。'):t('每排四口：c/e、d/f、g/b、a/高八度 c。两角为同一侧鼓音；可聚焦一排并切换音组。')),h('button',{className:'primary',onClick:()=>setSettings(false)},state.paused?t('返回暂停的练习'):t('完成'))),
    h('dialog',{className:'home-more-dialog',ref:homeMoreDialog,onCancel:()=>setHomeMore(false),'aria-labelledby':'home-more-title'},
      h('header',null,h('h2',{id:'home-more-title'},t('更多')),h('button',{className:'icon-button','aria-label':t('关闭更多选项'),onClick:()=>setHomeMore(false)},h(Icon,{name:'close'}))),
      h('label',{className:'sheet-volume'},h('span',null,t('钟声音量')),h('input',{type:'range',min:0,max:100,value:Math.round(volume*100),'aria-label':t('钟声音量'),onChange:e=>setVolume(Number(e.target.value)/100)}),h('output',null,`${Math.round(volume*100)}%`)),
      h('button',{className:'sheet-row',onClick:()=>{setHomeMore(false);replayArrival();}},h(Icon,{name:'sound'}),t('重听落钟'),h('span',null,'›')),
      h('div',{className:'sheet-audition'},h('button',{className:'secondary',onClick:()=>homeTone('center')},t('听中央')),h('button',{className:'secondary',onClick:()=>homeTone('left')},t('听侧边'))),
      [['library',t('乐谱'),'book'],['works',t('我的钟曲'),'home'],['observe',t('观赏钟体'),'eye'],['play',t('自由演奏'),'play']].map(([view,label,icon])=>h('button',{key:view,className:'sheet-row',onClick:()=>{setHomeMore(false);changeView(view);}},h(Icon,{name:icon}),label,h('span',null,'›')))),
    h('dialog',{className:'work-name-dialog',ref:workDialog,onCancel:event=>{event.preventDefault();closeWorkName();},'aria-labelledby':'work-name-heading'},workEdit&&h('form',{onSubmit:commitWorkName},
      h('header',null,h('h2',{id:'work-name-heading'},workEdit.kind==='new'?t('为这首钟曲取个名字'):t('修改曲名'))),
      h('label',{htmlFor:'work-name-input'},t('曲名')),h('input',{id:'work-name-input',ref:workNameInput,type:'text',value:workEdit.value,maxLength:80,autoComplete:'off','aria-describedby':'work-name-hint','aria-invalid':!!workEdit.error,onChange:event=>setWorkEdit(edit=>({...edit,value:Array.from(event.target.value).slice(0,40).join(''),error:''}))}),
      h('p',{id:'work-name-hint'},workEdit.error||t('最多 40 字。修改曲名不会改变录制内容。')),
      h('div',{className:'work-name-actions'},h('button',{type:'button',className:'text-button',onClick:closeWorkName},workEdit.kind==='new'?t('保留默认名'):t('取消')),h('button',{type:'submit',className:'primary'},workEdit.kind==='new'?t('保存钟曲'):t('保存曲名'))))),
    notice&&h('p',{className:'app-notice',role:'status'},notice));
}

window.ReactDOM.createRoot(document.getElementById('root')).render(h(App));
