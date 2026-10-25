// Absolute pitches are independent of the camera, layout and display names.
import { SIZE_STUDY } from './data/bell-sizes.mjs';
import { SUSPENSION } from './data/suspension-r6.mjs';
export {pairedBellAt as bellAt,pairedPositionForMidi as bellForMidi} from './paired-instrument.mjs';
export { SIZE_STUDY };
export const NATURALS = Object.freeze(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
export const OFFSETS = Object.freeze([0, 2, 4, 5, 7, 9, 11]);
export const PALETTE = Object.freeze({
  background: '#080e0c', body: '#66786d', frame: '#4c1915',
  feedback: '#c6aa68', text: '#ede2c9',
});
export const LIMITS = Object.freeze({
  target: 44, targetGap: 8, bodyWidth: 64, bodyHeight: 100,
  cellHeight: 124, rowGap: 12, minimumStageWidth: 0,
});

export function resolveStrikeRegion(bell,midi,preferred) {
  if(['center','left','right'].includes(preferred) && bell[preferred==='center'?'centerMidi':'sideMidi']===midi)return preferred;
  return bell.centerMidi===midi?'center':'right';
}

export function frequency(midi) { return 440 * 2 ** ((midi - 69) / 12); }

export function chooseLayout(width, height, { choice = 'auto', startOctave = 4, mobile = false, mode = 'play' } = {}) {
  if(mode==='observe')return {width,height,viewportWidth:width,rows:1,low:startOctave,octaves:[startOctave],cellWidth:width,cellHeight:height,portrait:false,requested:choice,frames:[{top:0,height}],scale:1};
  const portrait=width<600&&height>width;
  const desired=choice==='single'?1:choice==='full'?3:(!mobile&&height>720?3:2);
  const capacity=portrait?1:height>=470?3:height>=248?2:1;
  const rows=Math.min(desired,capacity);
  const columnCount=portrait?(width<340?3:4):7;
  const displayRows=portrait?Math.ceil(7/columnCount):rows;
  const gap=portrait?18:12;
  const cellHeight=(height-(displayRows-1)*gap)/displayRows;
  const padding=portrait?12:26;
  let cellWidth=(width-padding*2)/columnCount;
  const weights=Array.from({length:rows},(_,r)=>SIZE_STUDY.octaveFactor**(rows-1-r));
  let widthScale=(cellWidth-10)/.53;
  if(!portrait){
    let lo=0,hi=800;
    for(let i=0;i<28;i++){const candidate=(lo+hi)/2,used=SIZE_STUDY.columns.reduce((sum,r)=>sum+Math.max(68,.53*candidate*r+10),0);if(used<=width-padding*2)lo=candidate;else hi=candidate;}
    widthScale=lo;
  }
  const largestScale=Math.min(widthScale,(cellHeight-20)/.64,mobile?330:470);
  const scale=largestScale;
  const frames=Array.from({length:displayRows},(_,r)=>({top:r*(cellHeight+gap),height:cellHeight,weight:portrait?1:weights[r],mount:r*(cellHeight+gap)+(portrait||cellHeight>220?Math.max(8,(cellHeight-.7*scale)/2):8)}));
  const widths=SIZE_STUDY.columns.map(r=>portrait?cellWidth:Math.max(68,.53*scale*r+10));
  const extra=portrait?0:(width-padding*2-widths.reduce((sum,w)=>sum+w,0))/7;
  let x=padding;
  const columns=widths.map(w=>{const width=w+extra,result={x:x+width/2,width};x+=width;return result;});
  const low = Math.max(3, Math.min(startOctave, 7 - rows));
  const octaves = Array.from({ length: rows }, (_, i) => low + rows - 1 - i);
  const placements=octaves.flatMap((octave,row)=>Array.from({length:7},(_,column)=>({octave,row,column,
    frame:portrait?Math.floor(column/columnCount):row,width:portrait?cellWidth:columns[column].width,
    x:portrait?padding+((column%columnCount)+.5+(columnCount-Math.min(columnCount,7-Math.floor(column/columnCount)*columnCount))/2)*cellWidth:columns[column].x,
  })));
  return {width,height,viewportWidth:width,viewportHeight:height,rows,low,octaves,displayRows,
    cellWidth:portrait?cellWidth:Math.min(...columns.map(c=>c.width)),columnCount,cellHeight,portrait,compact:true,scale:scale/octaveSize(low),columns,frames,placements,
    mobile,minBodyHeight:mobile?48:40,minBodyWidth:mobile?40:32,
    fallback:rows<desired,requested:choice,playable:cellWidth>=66&&cellHeight>=112,
    fallbackReason:rows<desired?'当前尺寸使用聚焦音区':''
  };
}

// Focused performance lenses, not a replacement for the museum scale study.
// A register/subset has one uniform zoom; individual bells are never stretched.
export function performanceFocus(layout,row,column){
  if(!layout.compact)return 1;
  if(layout.portrait)return 1/SIZE_STUDY.columns[Math.floor(column/layout.columnCount)*layout.columnCount];
  return (1/SIZE_STUDY.octaveFactor)**(layout.rows-1-row);
}

export function rectanglesOverlap(a, b, gap = 0) {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}

export function projectedPitch(centers,index) {
  return Math.min(index?centers[index]-centers[index-1]:Infinity,index<centers.length-1?centers[index+1]-centers[index]:Infinity);
}

// Three 44px touch proxies are staggered, while the mallet always lands on
// the physical lower gu. Bound the side spread by the column pitch so both
// the two sides of one bell and adjacent bells retain an 8px separation.
export function touchTargets(id, points, columnPitch, bounds={top:0,bottom:Infinity}) {
  const middleX=(points.left.x+points.right.x)/2;
  const sideX=Math.min(middleX+Math.max(8,(columnPitch-48)/2),points.right.x);
  const top=Math.max(bounds.top+24,Math.min(points.center.y,points.right.y-52));
  const centerY=Math.min(top,bounds.bottom-78);
  const sideY=Math.min(bounds.bottom-26,Math.max(centerY+52,points.right.y));
  const centers={center:{x:middleX,y:centerY},right:{x:sideX,y:sideY}};
  return Object.entries(centers).map(([zone,p])=>({key:`${id}:${zone}`,id,zone,x:p.x-22,y:p.y-22,width:44,height:44}));
}

// Uniform scaling, never stretch the bell body. Not a measured tuning law.
export function octaveSize(octave){return SIZE_STUDY.octaveFactor**(octave-SIZE_STUDY.baseOctave);}
export function bellSize(octave,column){return octaveSize(octave)*SIZE_STUDY.columns[column];}

export function strikeMotion(age, reduced = false) {
  const contact = 0, duration = 260;
  const hitAge = Math.max(0, age - contact);
  const approach = 0;
  const rebound = Math.sin(Math.min(1,hitAge/260)*Math.PI/2);
  return {
    visible: !reduced && age >= 0 && age <= duration,
    offset: approach*26 + rebound*24,
    angle: approach*-.42 + rebound*.32,
    swing: reduced ? 0 : Math.sin(hitAge/50)*.008*Math.exp(-hitAge/135),
    energy: age < contact ? 0 : Math.exp(-hitAge/125),
  };
}

export function validateTargets(targets, bodies, width, height, limits={minBodyWidth:64,minBodyHeight:100}) {
  const issues = [];
  for (const target of targets) {
    if (target.width < 44 || target.height < 44) issues.push(`${target.key}: small target`);
    if (target.x < 0 || target.y < 0 || target.x + target.width > width + 0.1 || target.y + target.height > height + 0.1) issues.push(`${target.key}: clipped target`);
  }
  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      if (rectanglesOverlap(targets[i], targets[j], 7.99)) issues.push(`${targets[i].key} / ${targets[j].key}: gap < 8`);
    }
  }
  for (const body of bodies) {
    if (body.width < limits.minBodyWidth-.1 || body.height < limits.minBodyHeight-.1) issues.push(`${body.id}: small body`);
    if(Number.isFinite(body.x)&&(body.x<0||body.y<0||body.x+body.width>width+.1||body.y+body.height>height+.1))issues.push(`${body.id}: clipped body`);
    // Compact performance deliberately frames the playable body, not the full
    // yong. Observation keeps the complete, unmodified geometry.
    if(!limits.compact&&Number.isFinite(body.fullTop)&&(body.fullTop<0||body.fullBottom>height+.1))issues.push(`${body.id}: clipped yong`);
  }
  return issues;
}
