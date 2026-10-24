import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../app/vendor/three.module.min.js';
import {performanceLayout,bellNoteTags,findNoteTagHit,findPerformanceHit} from '../app/performance-layout.mjs';
import {sectionCapGeometry} from '../app/section-cap.mjs';
import {BELL_PAIRS} from '../app/paired-instrument.mjs';
import {validateTargets} from '../app/model.mjs';
import {BellAudio,activateSoundOnInteraction} from '../app/audio.mjs';
let checks=0;const check=(ok,message)=>{assert.ok(ok,message);checks++;};
for(const [width,height,mobile,portrait] of [[276,270,true,true],[342,570,true,true],[382,650,true,true],[520,214,true,false],[796,270,true,false],[980,600,false,false],[1396,1000,false,false]]){
  for(const noteStyle of ['pairs','clear','classic'])for(const low of [3,4,5]){
    const l=performanceLayout(width,height,{mobile,portrait,startOctave:low,noteStyle}),tags=l.bells.flatMap(b=>bellNoteTags(l,b));
    check([7,14,21].includes(l.bells.length)&&l.bells.length===l.rows*7,'every mode retains complete seven-bell banks');
    for(const b of l.bells){
      check(b.data.centerMidi%12===BELL_PAIRS[b.column].center&&b.data.sideMidi-b.data.centerMidi===BELL_PAIRS[b.column].side-BELL_PAIRS[b.column].center,'display alternatives preserve the agreed pitch pairing');
      check(b.targets.every(t=>t.width===44&&t.height===44),'primary strike entrances remain 44 CSS px');
      for(const region of ['center','left','right']){const p=b.points[region],hit=findPerformanceHit(l,p.x,p.y,{surfaceOnly:true,labels:true});check(hit?.bell.data.id===b.data.id&&hit.region===region,'physical center and both side faces still map to their own bell');}
      for(const t of bellNoteTags(l,b)){
        check(t.text===b.data[t.region==='center'?'centerName':'sideName'],'each visible label names the pitch it represents');
        const hit=findNoteTagHit(l,t.x+t.width/2,t.y+t.height/2);check(hit?.bell===b&&hit.region===t.region,'visible plaques produce the represented pitch');
        check(t.x>=0&&t.x+t.width<=width&&t.y>=0&&t.y+t.height<=height,'all visible labels stay inside the stage');
        if(noteStyle==='pairs')check(t.fontSize>=16,'paired labels keep a readable floor');
        if(noteStyle==='clear')check(t.fontSize>=14,'attached clear labels keep a readable floor');
      }
    }
    if(noteStyle!=='classic')for(let i=0;i<tags.length;i++)for(let k=i+1;k<tags.length;k++){
      const a=tags[i],b=tags[k];check(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)<.1||Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)<.1,'new note labels do not overlap');
    }
  }
}
for(const [w,h,portrait] of [[296,338,true],[351,437,true],[366,566,true],[544,203,false],[820,273,false],[993,633,false]])for(const noteStyle of ['pairs','classic']){
  const l=performanceLayout(w,h,{mobile:w<900,portrait,noteStyle});
  const bodies=l.bells.map(b=>({id:b.data.id,x:b.x,y:b.y+b.height*.26,width:b.width,height:b.height*.7}));
  check(validateTargets(l.bells.flatMap(b=>b.targets),bodies,w,h,l).length===0,'real supported viewports retain usable bell bodies and strike targets');
  if(noteStyle==='classic')for(const b of l.bells){
    const tags=bellNoteTags(l,b);check(tags.length===3&&tags.every(t=>t.fontSize>=12),'original-style plaques remain on the yong and both corners with moderately larger text');
    for(const t of tags.filter(t=>t.region!=='center'))check(Math.abs(t.anchorY-(b.y+b.height*.96))<.01&&t.y>=t.anchorY,'side plaques hang below the two mouth corners instead of floating beside the body');
  }
}
check(performanceLayout(820,273).noteStyle==='classic','the original plaque style is the default');
const activated=new EventTarget();let attempts=0,enabled=true;const removeActivation=activateSoundOnInteraction({prepareArrival(){attempts++;}},activated,()=>enabled);
activated.dispatchEvent(new Event('pointerdown'));activated.dispatchEvent(new Event('pointerup'));check(attempts===2,'ordinary page gestures prepare default-on audio');
enabled=false;activated.dispatchEvent(new Event('keydown'));check(attempts===2,'explicit mute or background gating is respected');removeActivation();enabled=true;activated.dispatchEvent(new Event('pointerdown'));check(attempts===2,'activation handlers are removed on cleanup');
const defaultAudio=new BellAudio();check(defaultAudio.muted===false,'a fresh visit starts with sound enabled');
globalThis.document={hidden:false};check(defaultAudio.landing()===false&&defaultAudio.voices.length===0,'blocked autoplay does not queue a delayed landing impact');delete globalThis.document;defaultAudio.dispose();
const originalSetTimeout=globalThis.setTimeout,originalClearTimeout=globalThis.clearTimeout;let idleCallback,idleDelay,idleSuspensions=0;
globalThis.setTimeout=(callback,delay)=>{idleCallback=callback;idleDelay=delay;return 1;};globalThis.clearTimeout=()=>{};
const idleAudio=new BellAudio();idleAudio.suspend=()=>{idleSuspensions++;};idleAudio.idleWhenQuiet();check(idleDelay===8000,'quiet gesture activation has a bounded audio lifetime');
idleAudio.voices=[{}];idleCallback();check(idleSuspensions===0,'an active bell tail is not suspended by idle cleanup');idleAudio.voices=[];idleCallback();check(idleSuspensions===1,'an empty audio context is suspended after idle activation');idleAudio.dispose();globalThis.setTimeout=originalSetTimeout;globalThis.clearTimeout=originalClearTimeout;
check((await readFile(new URL('../app/session.mjs',import.meta.url),'utf8')).includes('ymqn:3d:v1:works'),'recordings preserve the R14/R15 production identity');
check((await readFile(new URL('../app/audio.mjs',import.meta.url),'utf8')).includes('ymqn:3d:volume'),'volume preserves the production identity');
const runtime={window:{}};
for(const name of ['licensed-songs','zhuzhi-recording','songs'])vm.runInNewContext(await readFile(new URL(`../app/data/${name}.js`,import.meta.url),'utf8'),runtime);
for(const song of runtime.window.YMQNSongs)for(const path of Object.values(song.scoreFiles||{}))check((await readFile(new URL(`../app/${path}`,import.meta.url))).length>0,'every exposed score file exists in this independent prototype');
async function meshFile(path){
  const bytes=await readFile(path),length=bytes.readUInt32LE(12),j=JSON.parse(bytes.toString('utf8',20,20+length)),start=28+length,p=j.meshes[0].primitives[0],a=j.accessors[p.attributes.POSITION],v=j.bufferViews[a.bufferView],ia=j.accessors[p.indices],iv=j.bufferViews[ia.bufferView],size=ia.componentType===5123?2:4;
  const xyz=new Float32Array(a.count*3),idx=new Uint32Array(ia.count);
  for(let i=0;i<a.count;i++)for(let k=0;k<3;k++)xyz[i*3+k]=bytes.readFloatLE(start+(v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||12)+k*4);
  for(let i=0;i<ia.count;i++){const q=start+(iv.byteOffset||0)+(ia.byteOffset||0)+i*size;idx[i]=size===2?bytes.readUInt16LE(q):bytes.readUInt32LE(q);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(xyz,3));geometry.setIndex(new THREE.BufferAttribute(idx,1));return {geometry,j,bytes,triangles:ia.count/3};
}
const current=await meshFile(new URL('../app/models/single-bell.glb',import.meta.url));
check(current.bytes.length<5*1024*1024&&current.triangles<90000,'single-bell mobile model stays within its measured byte and triangle budget');
check(current.j.meshes.length===1&&current.j.meshes[0].primitives.length===1&&current.j.materials.length===1,'the optimized model uses one mesh, primitive and PBR material');
check(current.j.buffers.every(b=>!b.uri)&&current.j.images.length===3&&current.j.images.every(i=>!i.uri),'model textures and buffers are fully embedded');
const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
function ray(geometry,origin,direction){const mesh=new THREE.Mesh(geometry,material);mesh.updateMatrixWorld(true);return new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(...direction)).intersectObject(mesh);}
check(ray(current.geometry,[0,-.2,0],[0,1,0])[0]?.point.y>.50,'exported bell mouth is truly open to the inner ceiling');
const depths=[...new Set(ray(current.geometry,[0,.2,2],[0,0,-1]).map(h=>h.point.z.toFixed(6)))].map(Number);
check(depths.length>=4&&depths[0]-Math.min(...depths.filter(z=>z>0))>.026,'exported casting has distinct and visibly substantial inner and outer walls');
current.geometry.computeBoundingBox();const center=current.geometry.boundingBox.getCenter(new THREE.Vector3());current.geometry.translate(-center.x,-center.y,-center.z);const cap=sectionCapGeometry(current.geometry);
check(cap.userData.loops>0&&cap.userData.openChains===0,'actual optimized model has closed section contours');
current.geometry.dispose();cap.dispose();material.dispose();
console.log(`${checks} release bank, note readability, hit mapping, recording continuity and actual-model checks passed`);
