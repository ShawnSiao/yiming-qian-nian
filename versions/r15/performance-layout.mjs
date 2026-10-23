import { resolveStrikeRegion } from './model.mjs';
import { BELL_PAIRS, pairedBellAt as bellAt } from './paired-instrument.mjs';

// Preserve main's three distinct silhouettes. Lower/middle/upper voices use
// the large/medium/small original, including when only two registers are shown.
export function performanceBellStyle(octave,bankLow=4) {
  return ['bottom','middle','top'][Math.max(0,Math.min(2,octave-bankLow))];
}
const BELL_ASPECT={top:300/633,middle:320/577,bottom:340/524};

// Main's full bell silhouettes, not cropped 3D meshes. Sizes are display
// compensation for touch; this is not a measured reconstruction of the rack.
export function performanceLayout(width,height,{choice='auto',startOctave=4,mobile=false,portrait:portraitViewport}={}) {
  const portrait=width<600&&(typeof portraitViewport==='boolean'?portraitViewport:height>width);
  const desired=choice==='single'?1:choice==='full'?3:!mobile&&height>=470?3:2;
  const gap=portrait?8:12;
  const count=BELL_PAIRS.length;
  let columns=portrait?(width>=292?4:3):count;
  const capacity=portrait?Math.max(1,Math.min(3,Math.floor((height+gap)/(Math.ceil(count/columns)*(96+gap))))):height>=470?3:height>=248?2:1;
  const rows=Math.min(desired,capacity),low=Math.max(3,Math.min(startOctave,7-rows));
  const styleLow=Math.min(low,4);
  const octaves=Array.from({length:rows},(_,i)=>low+rows-1-i);
  // Landscape: all seven bells per row. Portrait wraps CDEF / GAB without
  // removing notes; single-register focus can use larger CDE / FGA / B groups.
  if(portrait&&rows===1&&height>=304)columns=3;
  const framesPerRegister=portrait?Math.ceil(count/columns):1,displayRows=rows*framesPerRegister;
  const padding=portrait?18:30,frameHeight=(height-gap*(displayRows-1))/displayRows;
  const cellWidth=(width-padding*2)/columns;
  const maxHeight=Math.min(frameHeight-(portrait?8:23),(cellWidth-8)/BELL_ASPECT.bottom,mobile?245:340);
  const frames=Array.from({length:displayRows},(_,row)=>({top:row*(frameHeight+gap),height:frameHeight}));
  const bells=octaves.flatMap((octave,row)=>Array.from({length:count},(_,column)=>{
    const data=bellAt(octave,column),group=portrait?Math.floor(column/columns):0,frame=row*framesPerRegister+group;
    const count=portrait?Math.min(columns,BELL_PAIRS.length-group*columns):BELL_PAIRS.length;
    const cx=padding+(portrait?(column%columns)+(columns-count)/2:column)*cellWidth+cellWidth/2;
    // Small phones need legible complete silhouettes and room for two 44px
    // entrances. Desktop retains a stronger large-to-small graduation.
    const ratio=portrait||width<620||(mobile&&frameHeight<124)?[1,.98,.96,.94,.92,.90,.88][column]:mobile?[1,.96,.92,.89,.85,.82,.78][column]:data.sizeRatio;
    const imageKey=performanceBellStyle(octave,styleLow);
    const h=maxHeight*ratio,w=h*BELL_ASPECT[imageKey],y=frames[frame].top+(portrait?8:13);
    const points={center:{x:cx,y:y+h*.66},left:{x:cx-w*.33,y:y+h*.79},right:{x:cx+w*.33,y:y+h*.79}};
    const sideY=Math.min(frames[frame].top+frameHeight-(portrait?22:25),Math.max(frames[frame].top+(portrait?74:79),points.right.y));
    const centerY=Math.min(y+h*.48,sideY-52);
    const targets=[{region:'center',x:cx-22,y:centerY-22},{region:'right',x:Math.min(cx+cellWidth*.15,cx+w*.3)-22,y:sideY-22}]
      .map(t=>({...t,key:`${data.id}:${t.region}`,id:data.id,zone:t.region,width:44,height:44}));
    return {data,row,column,frame,imageKey,cx,x:cx-w/2,y,width:w,height:h,points,targets,cellWidth};
  }));
  return {width,height,viewportWidth:width,viewportHeight:height,rows,low,styleLow,octaves,portrait,displayRows,framesPerRegister,frames,columns,cellWidth,bells,mobile,
    compact:true,requested:choice,fallback:rows<desired,renderer:'main-canvas',minBodyWidth:mobile?36:26,minBodyHeight:mobile?48:36};
}

// Browser chrome may resize the canvas without changing the available notes.
// Pause only for a real change of bank or input arrangement, not every pixel.
export function performanceLayoutChanged(previous,next){
  return !!previous&&(['rows','portrait','columns','displayRows'].some(k=>previous[k]!==next[k])||previous.octaves.join(',')!==next.octaves.join(','));
}

// Main's attached plates: natural on the yong, the same side tone on both
// lower corners. Keep a legibility floor rather than shrinking with the bell.
// Both sides always repeat the side pitch, including the A/next-C octave crossing.
export function bellNoteTags(layout,bell) {
  return [['center',bell.data.centerName,.15],['left',bell.data.sideName,.76],['right',bell.data.sideName,.76]].map(([region,text,level])=>{
    const fontSize=region==='center'?Math.max(11,Math.min(12,bell.width*.10)):Math.max(10,Math.min(10.5,bell.width*.09));
    const width=Math.max(region==='center'?22:18,Math.ceil(text.length*fontSize*.60+7));
    const height=fontSize+(region==='center'?5:4);
    const span=Math.min(Math.max(bell.width*.33,width/2+2),(bell.cellWidth-width-8)/2);
    const anchor=bell.cx+(region==='center'?0:region==='left'?-span:span);
    const x=Math.max(5,Math.min(layout.width-width-5,anchor-width/2));
    return {id:bell.data.id,key:`${bell.data.id}:${region}`,region,text,fontSize,width,height,x,y:bell.y+bell.height*level-height/2};
  });
}

export function findNoteTagHit(layout,x,y) {
  for(const bell of layout.bells){
    const tag=bellNoteTags(layout,bell).find(t=>x>=t.x&&x<=t.x+t.width&&y>=t.y&&y<=t.y+t.height);
    if(tag)return {bell,region:tag.region};
  }
  return null;
}

export function resolveTargetPointer(layout,bell,region,x,y,labels=false){
  const tag=labels&&findNoteTagHit(layout,x,y);
  if(tag)return tag;
  const surface=findPerformanceHit(layout,x,y,{surfaceOnly:true});
  // A 44px proxy may cover a different physical region on a small bell.
  // Visible metal always wins; only the transparent extension uses its proxy.
  return surface?.bell===bell?surface:{bell,region};
}

export function findPerformanceHit(layout,x,y,{surfaceOnly=false,labels=false}={}) {
  const tag=labels&&findNoteTagHit(layout,x,y);
  if(tag)return tag;
  for(const bell of layout.bells){
    if(!surfaceOnly){
      const target=bell.targets.find(t=>x>=t.x&&x<=t.x+44&&y>=t.y&&y<=t.y+44);
      if(target)return {bell,region:target.region};
    }
    const u=(x-bell.x)/bell.width,v=(y-bell.y)/bell.height;
    // The central yong/nameplate is tappable too, like main. Reject only
    // its transparent surrounding corners, never a visible natural label.
    if(v<.05||v>.96||u<.05||u>.95||(v<.25&&Math.abs(u-.5)>.2))continue;
    if(v<.25)return {bell,region:'center'};
    return {bell,region:u<.32?'left':u>.68?'right':'center'};
  }
  return null;
}

export function performanceContact(layout,midi,preferred,bellId) {
  const candidates=layout.bells.filter(b=>midi===b.data.centerMidi||midi===b.data.sideMidi);
  const preferredMatches=b=>['center','left','right'].includes(preferred)&&b.data[preferred==='center'?'centerMidi':'sideMidi']===midi;
  const bell=candidates.find(b=>b.data.id===bellId)||candidates.find(preferredMatches)||candidates.find(b=>b.data.centerMidi===midi)||candidates[0];
  if(!bell)return null;
  const region=resolveStrikeRegion(bell.data,midi,preferred);
  return {bell,region,point:bell.points[region]};
}
