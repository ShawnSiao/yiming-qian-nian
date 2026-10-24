// Homepage-only helpers: observation never changes the performance instrument.
export function initialView(search=''){
  const view=new URLSearchParams(search).get('view');
  return ['home','play','observe','library','works'].includes(view)?view:'home';
}
export function homeStrikeRegion(u,v){
  if(!Number.isFinite(u)||!Number.isFinite(v)||u<0||u>1||v<0||v>1)return null;
  return v<.48?'center':u<.32?'left':u>.68?'right':'center';
}
export function homeCameraFit(width,height,size={x:.91,y:2,z:.65}){
  const aspect=Math.max(.1,width/Math.max(1,height)),fov=36,tangent=Math.tan(fov*Math.PI/360);
  // Fit both the full yong and the widest rotated shell, not just a front card.
  const span=Math.hypot(size.x,size.z);
  return {fov,distance:Math.max(size.y/(2*tangent),span/(2*tangent*aspect))/.95+size.z/2};
}
export class HomeGesture {
  constructor(){this.pointers=new Map();}
  start({pointerId,clientX,clientY,timeStamp}){
    const multi=this.pointers.size>0;
    if(multi)for(const pointer of this.pointers.values())pointer.multi=true;
    this.pointers.set(pointerId,{x:clientX,y:clientY,time:timeStamp,multi,moved:false});
  }
  move({pointerId,clientX,clientY}){
    const pointer=this.pointers.get(pointerId);
    if(pointer&&Math.hypot(clientX-pointer.x,clientY-pointer.y)>8)pointer.moved=true;
  }
  end(event,cancelled=false){
    this.move(event);const pointer=this.pointers.get(event.pointerId);this.pointers.delete(event.pointerId);
    if(!pointer||cancelled||pointer.multi||pointer.moved||event.timeStamp-pointer.time>450)return null;
    return {x:event.clientX,y:event.clientY};
  }
  clear(){this.pointers.clear();}
}
