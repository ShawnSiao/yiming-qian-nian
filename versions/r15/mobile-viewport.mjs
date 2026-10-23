// The visual viewport excludes browser toolbars and keyboards. Pinch zoom
// should magnify the current layout, not recursively shrink/rebuild it.
export function visibleViewportHeight(innerHeight,visualHeight,scale=1,previousHeight){
  const valid=n=>Number.isFinite(n)&&n>0;
  if(Math.abs(scale-1)>.02)return valid(previousHeight)?previousHeight:valid(innerHeight)?Math.floor(innerHeight):undefined;
  const height=valid(visualHeight)?Math.min(valid(innerHeight)?innerHeight:visualHeight,visualHeight):innerHeight;
  return valid(height)?Math.floor(height):previousHeight;
}

export function supportsFullscreen(doc){
  return doc.fullscreenEnabled!==false&&typeof doc.documentElement?.requestFullscreen==='function';
}

// Prototype-only safety regression: legacy left/right/bottom or all four sides.
export function simulatedSafeArea(value){
  if(typeof value!=='string'||!/^\d{1,2}(,\d{1,2}){2,3}$/.test(value))return {};
  const values=value.split(',').map(Number),sides=values.length===4?['top','left','right','bottom']:['left','right','bottom'];
  return sides.reduce((result,side,index)=>({...result,[side]:values[index]}),{});
}

export function observeViewport(win,root){
  let frame=0,height;
  const measure=()=>{
    frame=0;
    const next=visibleViewportHeight(win.innerHeight,win.visualViewport?.height,win.visualViewport?.scale??1,height);
    if(next!==height&&Number.isFinite(next)){height=next;root.style.setProperty('--viewport-height',`${next}px`);}
  };
  const update=()=>{if(!frame)frame=win.requestAnimationFrame(measure);};
  measure();
  for(const type of ['resize','orientationchange','pageshow'])win.addEventListener(type,update);
  win.visualViewport?.addEventListener('resize',update);
  return()=>{
    win.cancelAnimationFrame(frame);
    for(const type of ['resize','orientationchange','pageshow'])win.removeEventListener(type,update);
    win.visualViewport?.removeEventListener('resize',update);
  };
}
