import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {performanceLayout,performanceLayoutChanged,performanceBellStyle,findPerformanceHit,performanceContact,bellNoteTags,findNoteTagHit,resolveTargetPointer} from './performance-layout.mjs';
import {validateTargets,rectanglesOverlap} from './model.mjs';
import {PerformanceScene,drawNotePlaque} from './performance.mjs';
import {scoreEvents,practiceSections} from './session.mjs';
let checks=0;function check(test,label){assert.ok(test,label);checks++;}
for(const [width,height,portrait] of [[820,282],[643,267],[788,279],[720,242],[362,592],[296,442],[332,463],[1240,634],[932,1144],[292,344],[292,256,true],[292,236,true],[347,415],[362,412],[386,644],[544,212],[732,192],[732,248],[732,254]]){
  const mobile=width<900;
  for(const choice of ['auto','single','full'])for(const startOctave of [3,4,5,6]){
    const layout=performanceLayout(width,height,{mobile,choice,startOctave,portrait});
    const targets=layout.bells.flatMap(b=>b.targets),bodies=layout.bells.map(b=>({id:b.data.id,x:b.x,y:b.y+b.height*.26,width:b.width,height:b.height*.7}));
    check(!validateTargets(targets,bodies,width,height,layout).length,`${width}x${height} ${choice}: visible targets and silhouettes`);
    check(layout.bells.length===layout.rows*7,'every visible register keeps all seven bells regardless of viewport or focus choice');
    const tags=layout.bells.flatMap(b=>bellNoteTags(layout,b));
    check(tags.length===layout.bells.length*3,'every paired bell has yong and both identical corner tags');
    check(tags.every(t=>t.x>=0&&t.y>=0&&t.x+t.width<=width&&t.y+t.height<=height),'all note tags stay inside the stage');
    check(tags.every((a,i)=>tags.slice(i+1).every(b=>!rectanglesOverlap(a,b,1))),'neighboring note tags never overlap');
    for(const octave of layout.octaves){
      const bells=layout.bells.filter(b=>b.data.octave===octave);
      check(bells.map(b=>b.data.natural).join('')==='CDEFGAB','all seven natural center pitches in ascending order');
      check(bells.every((b,i)=>!i||b.height<bells[i-1].height),'large to small, no identical-height row');
    }
    for(const bell of layout.bells){
      check(bell.imageKey===performanceBellStyle(bell.data.octave,layout.styleLow),'focus retains the corresponding three-register bank silhouette');
      for(const region of ['center','left','right']){
        const point=bell.points[region];
        const covering=bell.targets.find(t=>point.x>=t.x&&point.x<=t.x+44&&point.y>=t.y&&point.y<=t.y+44);
        for(const labels of [false,true]){
          const actual=covering?resolveTargetPointer(layout,bell,covering.region,point.x,point.y,labels):findPerformanceHit(layout,point.x,point.y,{surfaceOnly:true,labels});
          check(actual?.bell===bell&&actual.region===region,'every physical impact remains correct even beneath a different 44px proxy');
        }
      }
      for(const target of bell.targets){
        const hit=findPerformanceHit(layout,target.x+22,target.y+22);
        check(hit?.bell.data.id===bell.data.id&&hit.region===target.region,'44px proxy resolves the correct absolute note');
        const tagHit=findNoteTagHit(layout,target.x+22,target.y+22);
        check(!tagHit||(tagHit.bell===bell&&tagHit.region===target.region),'tags do not hijack another major strike entrance');
      }
      for(const tag of bellNoteTags(layout,bell)){
        const hit=findPerformanceHit(layout,tag.x+tag.width/2,tag.y+tag.height/2,{surfaceOnly:true,labels:true});
        check(hit?.bell===bell&&hit.region===tag.region,'visible label plays its own modern pitch');
        check(tag.text===(tag.region==='center'?bell.data.centerName:bell.data.sideName),'tag text exactly matches the sounding pitch');
        check(tag.fontSize>=10&&tag.height<=17,'main-sized plaques retain a 10px readability floor, not button-sized 20px plates');
        check(tag.region==='center'?Math.abs(tag.x+tag.width/2-bell.cx)<1&&tag.y+tag.height/2<bell.y+bell.height*.25:tag.y+tag.height/2>bell.y+bell.height*.7,'natural stays on yong; sides stay on lower corners');
      }
      const left=bell.points.left,hit=findPerformanceHit(layout,left.x,left.y,{surfaceOnly:true});
      check(hit?.bell===bell&&hit.region==='left','left surface remains directly playable');
      const labelledHit=findPerformanceHit(layout,left.x,left.y,{surfaceOnly:true,labels:true});
      check(labelledHit?.bell===bell&&labelledHit.region==='left','side labels do not change the actual left striking region');
      const covering=bell.targets.find(t=>left.x>=t.x&&left.x<=t.x+44&&left.y>=t.y&&left.y<=t.y+44);
      const routed=covering?resolveTargetPointer(layout,bell,covering.region,left.x,left.y,false):hit;
      check(routed?.bell===bell&&routed.region==='left','small-bell left surface remains left even with labels off and a covering right proxy');
      check(bell.data.sideMidi-bell.data.centerMidi===[4,3,0,1,4,3,0][bell.column],'sketched C/D/G/A pairing plus retained E/E, F/F-sharp and B/B');
      const contact=performanceContact(layout,bell.data.sideMidi,'left',bell.data.id);
      check(contact?.region==='left'&&contact.point===bell.points.left,'recorded left contact is preserved');
    }
    if(layout.rows===3)check(layout.octaves.map(o=>layout.bells.find(b=>b.data.octave===o).imageKey).join(',')==='top,middle,bottom','every full three-register bank restores three distinct main originals');
  }
}
const layout=performanceLayout(820,282,{mobile:true});let reframed=0,notes=0;
const full=performanceLayout(1240,634,{startOctave:4});
const portrait=performanceLayout(362,592,{mobile:true}),shortPortrait=performanceLayout(292,236,{mobile:true,portrait:true});
check(portrait.rows===2&&portrait.bells.length===14&&portrait.columns===4&&portrait.framesPerRegister===2,'portrait wraps seven bells as CDEF / GAB, never deleting E/F/B');
check(new Set(portrait.bells.flatMap(b=>[b.data.centerMidi,b.data.sideMidi])).size===17,'two groups cover seventeen distinct pitches, including F-sharp and their shared boundary C');
const completeRange=[...new Set([3,4,5].flatMap(startOctave=>performanceLayout(362,592,{mobile:true,startOctave}).bells.flatMap(b=>[b.data.centerMidi,b.data.sideMidi])))].sort((a,b)=>a-b);
check(completeRange.length===33&&completeRange[0]===48&&completeRange.at(-1)===96&&completeRange.every(m=>[0,2,4,5,6,7,9,11].includes(m%12)),'bank controls cover C3 through C7 naturals plus the retained F-sharp, without inventing other sharps');
const tallFull=performanceLayout(386,644,{mobile:true,choice:'full'});
check(tallFull.rows===3&&tallFull.bells.length===21&&new Set(tallFull.bells.flatMap(b=>[b.data.centerMidi,b.data.sideMidi])).size===25,'full view keeps three complete seven-bell groups and twenty-five distinct pitches');
check(shortPortrait.rows===1&&shortPortrait.bells.length===7,'short browser viewport reduces visible groups, not the seven bells within a group');
check(!performanceLayoutChanged(portrait,performanceLayout(362,540,{mobile:true})),'address-bar height change with the same bank must not interrupt');
check(performanceLayoutChanged(portrait,shortPortrait),'a real input-layout change pauses intentionally');
check(performanceLayoutChanged(portrait,performanceLayout(362,592,{mobile:true,startOctave:3})),'changing the absolute register bank is not mistaken for browser chrome');
check(full.octaves.map(o=>full.bells.find(b=>b.data.octave===o).imageKey).join(',')==='top,middle,bottom','default three rows use three different main originals');
check(layout.bells.filter(b=>b.row===0).every(b=>b.imageKey==='middle')&&layout.bells.filter(b=>b.row===1).every(b=>b.imageKey==='bottom'),'phone lower pair uses medium and large originals, not two small rows');
const first=layout.bells[0];
check(findPerformanceHit(layout,first.cx,first.y+first.height*.16,{surfaceOnly:true})?.region==='center','natural nameplate/yong remains tappable like main');
check(!findPerformanceHit(layout,first.x,first.y+first.height*.1,{surfaceOnly:true}),'transparent yong corners do not trigger a bell');
const plaqueTrace=[],plaqueStops=[],plaqueText=[],plaqueCtx={
  save(){},restore(){},beginPath(){},closePath(){},moveTo(x,y){plaqueTrace.push([x,y]);},lineTo(x,y){plaqueTrace.push([x,y]);},fill(){},stroke(){},
  createLinearGradient(){return {addColorStop(offset,color){plaqueStops.push([offset,color]);}};},
  fillText(text,x,y){plaqueText.push({text,x,y,color:this.fillStyle,alpha:this.globalAlpha});},
};
const samplePlaque=bellNoteTags(layout,first)[0];
drawNotePlaque(plaqueCtx,samplePlaque);
check(plaqueTrace.length===20&&plaqueTrace.flat().every(Number.isFinite),'main eyelet plus two eight-sided copper rims, no rounded DOM box');
check(plaqueStops.map(s=>s[1]).join(',')==='#29342d,#202b25,#111815','main original patinated bronze fill');
check(plaqueText[0].color==='#c7b27a'&&plaqueText[0].alpha===1,'original warm inscription color, clearer without white UI lettering');
drawNotePlaque(plaqueCtx,samplePlaque,true);
check(plaqueStops.slice(3).map(s=>s[1]).join(',')==='#765523,#d0ad60,#624419'&&plaqueText[1].color==='#24180b','striking retains main warm copper highlight');
const stationary={layout,audio:{strike(){notes++;return Promise.resolve();}},setOptions(){reframed++;},strike(){notes++;}};
PerformanceScene.prototype.strikeMidi.call(stationary,48,'playback',.2);
check(notes===1&&reframed===0,'offscreen accompaniment is audio-only');
PerformanceScene.prototype.strikeMidi.call(stationary,60,'playback',.85,'left');
check(notes===2&&reframed===0,'visible playback keeps fixed bank');

const data={};data.window=data;
for(const path of ['data/licensed-songs.js','data/songs.js'])vm.runInNewContext(await readFile(new URL(path,import.meta.url),'utf8'),data);
const song=data.YMQNSongs.find(s=>s.id==='zhuzhi-ci');
check(song?.jianpuBars.length===8,'all eight provided bars, not an invented full arrangement');
check(song.events.length===34,'34 notated note onsets');
check(song.jianpuBars.every(bar=>bar.reduce((sum,n)=>sum+n.duration,0)===4),'each 4/4 bar totals four beats');
check(song.events.at(-1).beat+song.events.at(-1).durationBeat===32,'complete 32-beat theme');
check(song.events.map(e=>e.midi).join(',')==='57,62,62,60,62,62,60,62,62,67,69,64,64,62,60,62,64,62,67,67,69,69,64,67,69,60,57,62,64,64,60,62,64,62','transcription including two low A3 notes');
check(song.events[6].durationBeat===.75&&song.events[7].durationBeat===.25,'dotted eighth followed by sixteenth, not equalized notes');
check(song.events[23].durationBeat===1.5&&song.events[24].durationBeat===.5,'bar six dotted quarter and eighth');
check(song.events[31].durationBeat===1.5&&song.events[33].durationBeat===2,'final held note preserved');
for(const rate of [.6,.72,.9,1]){
  const events=scoreEvents(song,rate);
  check(practiceSections(events,2).length===1,'theme fits adjacent registers 3–4 without switching');
  check(events.every((e,i)=>Math.abs(e.time-song.events[i].beat*60000/64/rate)<.001),'audition and following preserve exact beat positions');
}
check(!song.listenEvents,'no unsourced accompaniment claimed');
for(const file of ['app.mjs','instrument.mjs','performance.mjs','performance-layout.mjs']){
  const source=await readFile(new URL(file,import.meta.url),'utf8');
  check(!/^import .*from ['"].*(scene|geometry|three|GLTF)/m.test(source),'performance static graph does not import WebGL or models');
}
for(const size of ['small','medium','large']){
  const path=`assets/images/bell-${size}-v2.webp`;
  const bytes=await readFile(new URL(path,import.meta.url));
  check(bytes.equals(await readFile(new URL(`../../${path}`,import.meta.url))),'each restored silhouette is byte-identical to main, not a new approximation');
  const key={small:'top',medium:'middle',large:'bottom'}[size],bell=full.bells.find(b=>b.imageKey===key);
  check(bytes.toString('ascii',12,16)==='VP8X'&&Math.abs(bell.width/bell.height-(bytes.readUIntLE(24,3)+1)/(bytes.readUIntLE(27,3)+1))<1e-8,'display silhouette matches actual WebP header dimensions');
}
const app=await readFile(new URL('app.mjs',import.meta.url),'utf8');
check(app.includes('ymqn:')===false,'scene swap does not change the existing recording identity');
console.log(`${checks} main-style performance, hit-region and Zhu Zhi Ci checks passed`);
