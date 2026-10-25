import * as THREE from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
export const ANCHORS = Object.freeze({
  center: [0, .395, .137], left: [-.133, .13, .10], right: [.133, .13, .10],
  strikeCenter: [0, .155, .128], strikeLeft: [-.162, .145, .068], strikeRight: [.162, .145, .068],
  naturalLabel: [0, .512, .145], leftLabel: [-.174, .103, .08], rightLabel: [.174, .103, .08],
});

export async function loadObservationGeometry({bytes}={}) {
  const loader=new GLTFLoader();
  const gltf=bytes?await loader.parseAsync(bytes.slice(0),new URL('./models/',import.meta.url).href):await loader.loadAsync(new URL('./models/single-bell.glb',import.meta.url).href);
  gltf.scene.updateMatrixWorld(true);
  let mesh;
  gltf.scene.traverse(o=>{if(o.isMesh&&!mesh)mesh=o;});
  if(!mesh)throw new Error('The observation model has no bell mesh');
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
