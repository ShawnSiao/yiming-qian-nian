import * as THREE from './vendor/three.module.min.js';

// A small studio reflection environment built once. No animated background or
// per-frame environment capture; all surfaces are project-owned geometry.
export function createBronzeEnvironment(renderer) {
  const studio=new THREE.Scene();studio.background=new THREE.Color('#0c1410');
  const geometry=new THREE.BoxGeometry(1,1,1),materials=[];
  function panel(color,position,scale){
    const material=new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(2.5),side:THREE.BackSide});materials.push(material);
    const box=new THREE.Mesh(geometry,material);box.position.set(...position);box.scale.set(...scale);studio.add(box);
  }
  panel('#1b2520',[0,0,0],[10,10,10]);
  // Bright strips give metal a broad highlight, with a dark opposing field.
  panel('#f3e8d4',[-4,2,1],[.1,3.8,1.8]);
  panel('#bacfc8',[3,1,-2],[.1,3,.8]);
  panel('#080c09',[0,-3,2],[5,.1,4]);
  panel('#c5b083',[0,4,-1],[3,.1,1.6]);
  const pmrem=new THREE.PMREMGenerator(renderer);
  const target=pmrem.fromScene(studio,.06,.1,30,{size:128});
  pmrem.dispose();geometry.dispose();materials.forEach(m=>m.dispose());
  return target;
}
