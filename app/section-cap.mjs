import * as THREE from './vendor/three.module.min.js';

// A section of the actual exported geometry, not an invented internal mechanism.
// The model is already centered by the viewer; local Z=0 is the cut plane.
export function sectionCapGeometry(geometry){
  const position=geometry.getAttribute('position'),index=geometry.index;
  const nodes=new Map(),edges=[],epsilon=1e-7;
  function vertex(p){
    const key=`${Math.round(p.x*1e6)},${Math.round(p.y*1e6)}`;
    if(!nodes.has(key))nodes.set(key,{key,p:new THREE.Vector2(p.x,p.y),edges:[]});
    return nodes.get(key);
  }
  for(let i=0;i<(index?.count||position.count);i+=3){
    const p=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(position,index?index.getX(i+k):i+k));
    if(p.every(v=>v.z>epsilon)||p.every(v=>v.z<-epsilon)||p.every(v=>Math.abs(v.z)<=epsilon))continue;
    const hits=[];
    for(let k=0;k<3;k++){
      const a=p[k],b=p[(k+1)%3];
      if(Math.abs(a.z)<=epsilon)hits.push(a.clone());
      if(a.z*b.z<0&&Math.abs(a.z)>epsilon&&Math.abs(b.z)>epsilon)hits.push(a.clone().lerp(b,a.z/(a.z-b.z)));
    }
    const unique=hits.filter((v,k)=>!hits.slice(0,k).some(w=>v.distanceToSquared(w)<epsilon*epsilon));
    if(unique.length!==2||unique[0].distanceToSquared(unique[1])<1e-14)continue;
    const a=vertex(unique[0]),b=vertex(unique[1]);
    if(a===b||a.edges.some(e=>e.a===b||e.b===b))continue;
    const edge={a,b,used:false};a.edges.push(edge);b.edges.push(edge);edges.push(edge);
  }
  const shapes=[];let openChains=0;
  for(const first of edges){
    if(first.used)continue;
    const points=[],start=first.a;let node=start,edge=first,closed=false;
    for(let guard=0;guard<=edges.length;guard++){
      points.push(node.p);edge.used=true;node=edge.a===node?edge.b:edge.a;
      if(node===start){closed=true;break;}
      edge=node.edges.find(candidate=>!candidate.used);if(!edge)break;
    }
    if(!closed){openChains++;continue;}
    if(points.length<3||Math.abs(THREE.ShapeUtils.area(points))<1e-9)continue;
    const shape=new THREE.Shape(points);shapes.push(shape);
  }
  const cap=new THREE.ShapeGeometry(shapes);cap.userData={loops:shapes.length,openChains};
  return cap;
}
