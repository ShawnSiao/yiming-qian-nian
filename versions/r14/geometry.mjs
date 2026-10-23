import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { SIZE_STUDY } from './data/bell-sizes.mjs';
import { SUSPENSION } from './data/suspension-r6.mjs';
export { SUSPENSION };

// Normalized museum-photo study coordinates, glTF Y-up. Touch proxies and
// physical lower-gu contacts are separate so phone targets need not be tiny.
export const ANCHORS = Object.freeze({
  center: [0, .395, .137], left: [-.133, .13, .10], right: [.133, .13, .10],
  strikeCenter: [0, .155, .128], strikeLeft: [-.162, .145, .068], strikeRight: [.162, .145, .068],
  naturalLabel: [0, .512, .145], leftLabel: [-.174, .103, .08], rightLabel: [.174, .103, .08],
});
export const STRIKE_REGIONS = Object.freeze(['center', 'left', 'right']);
export const STRIKE_ANCHORS = Object.freeze({center:'strikeCenter',left:'strikeLeft',right:'strikeRight'});
export const BELL_YAW = SUSPENSION.yaw;
export const BELL_TILT = SUSPENSION.tilt;
export const BELL_TOP = 1;
export const BODY_TOP = .546;
export const FOCUS_TOP = SUSPENSION.focusTop;
export const MALLET_TIP = [0, .50, -.062];

export function frameCamera(camera,width,height,mode='play') {
  const distance=mode==='observe'?1250:1600;
  camera.aspect=width/height;
  camera.fov=2*Math.atan(height/(2*distance))*180/Math.PI;
  camera.updateProjectionMatrix();
}

export function performanceCamera(camera) {
  camera.position.set(-48,50,1600);camera.up.set(0,1,0);
  camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
}

export function suspensionPoint(layout,row,col) {
  const place=layout.placements?.find(p=>p.row===row&&p.column===col);
  const frame=layout.frames[place?.frame??row];
  return new THREE.Vector3(-layout.width/2+(place?.x??layout.columns[col].x),layout.height/2-frame.mount-(layout.compact?8:34),(layout.rows-1-row)*SUSPENSION.rowDepth-22);
}

export async function loadBellGeometry() {
  const mobile=matchMedia('(pointer: coarse)').matches||Math.min(innerWidth,innerHeight)<600||innerWidth<1000;
  const url=mobile?'./models/ensemble-performance-r7.glb':'./models/ensemble-suspension-r6.glb';
  const gltf = await new GLTFLoader().loadAsync(new URL(url, import.meta.url).href);
  gltf.scene.updateMatrixWorld(true);
  const assets = {};
  for (const name of [...'CDEFGAB'].map(n=>'Bell_'+n).concat(['CopperMallet','RackBeam','RackPost','RackFoot','RackBracket','Hanger','SuspensionSaddle','SuspensionLink'])) {
    const source = gltf.scene.getObjectByName(name);
    if (!source) throw new Error(`模型缺少组件 ${name}`);
    const group = new THREE.Group();
    source.traverse(object => {
      if (!object.isMesh) return;
      const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
      geometry.computeBoundingBox();
      group.add(new THREE.Mesh(geometry, object.material));
    });
    assets[name] = group;
  }
  gltf.scene.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
  assets.dispose = () => {
    const materials = new Set(), textures = new Set();
    for (const value of Object.values(assets)) if (value.isGroup) value.traverse(o => {
      if (!o.isMesh) return;
      o.geometry.dispose(); materials.add(o.material);
    });
    for (const m of materials) { for (const value of Object.values(m)) if (value?.isTexture) textures.add(value); m.dispose(); }
    for (const texture of textures) { texture.source.data?.close?.(); texture.dispose(); }
  };
  return assets;
}

export async function loadObservationGeometry() {
  const gltf=await new GLTFLoader().loadAsync(new URL('./models/single-bell-observation.glb',import.meta.url).href);
  gltf.scene.updateMatrixWorld(true);
  let mesh;
  gltf.scene.traverse(o=>{if(o.isMesh&&!mesh)mesh=o;});
  if(!mesh)throw new Error('观赏模型缺少钟体');
  const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  geometry.computeBoundingBox();
  gltf.scene.traverse(o=>{if(o.isMesh)o.geometry.dispose();});
  return {geometry,material:mesh.material,dispose(){
    geometry.dispose();
    for(const value of Object.values(mesh.material))if(value?.isTexture){value.source.data?.close?.();value.dispose();}
    mesh.material.dispose();
  }};
}

export function createRack(assets, layout, scale, observing = false) {
  const group = new THREE.Group();
  if(observing)return group;
  function add(name, position, scale) {
    const o=assets[name].clone();o.position.set(...position);o.scale.set(...scale);group.add(o);
  }
  const first=layout.frames[0],last=layout.frames.at(-1);
  const top=first.mount-4,bottom=layout.height-10;
  group.userData.floorY=layout.height/2-bottom;
  for (const x of [-layout.width/2+24, layout.width/2-24]) {
    add('RackPost',[x,layout.height/2-(top+bottom)/2,-78],[160,bottom-top,220]);
    add('RackFoot',[x,layout.height/2-bottom,-60],[150,160,220]);
  }
  for(let row=0;row<layout.frames.length;row++) {
    const y=layout.height/2-layout.frames[row].mount;
    const z=(layout.rows-1-row)*SUSPENSION.rowDepth-48;
    add('RackBeam',[0,y,z],[layout.width-44,layout.compact?80:180,layout.compact?120:220]);
    for(const x of [-layout.width/2+24,layout.width/2-24])add('RackBracket',[x,y-5,-65],[170,170,200]);
  }
  return group;
}
