import * as THREE from './vendor/three.module.min.js';
import {ARRIVAL,dustParticle} from './home-arrival.mjs';

// One 32-point draw while dust disperses, one inexpensive contact-shadow plane.
// No shadow-map pass, external image or permanent particle loop.
export class HomeLanding {
  constructor(scene,floor){
    this.floor=floor;this.root=new THREE.Group();scene.add(this.root);
    const shadowMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
      uniforms:{strength:{value:0}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:'varying vec2 vUv; uniform float strength; void main(){float r=length((vUv-.5)*2.0);float a=pow(max(0.0,1.0-r),2.0)*strength;gl_FragColor=vec4(.025,.022,.016,a);}',side:THREE.DoubleSide});
    this.shadow=new THREE.Mesh(new THREE.PlaneGeometry(1.45,.88),shadowMaterial);this.shadow.rotation.x=-Math.PI/2;this.shadow.position.set(0,floor-.006,0);this.root.add(this.shadow);
    const positions=new Float32Array(ARRIVAL.particles*3),sizes=new Float32Array(ARRIVAL.particles);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('puffSize',new THREE.BufferAttribute(sizes,1));
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
      uniforms:{opacity:{value:0},height:{value:900}},
      vertexShader:'attribute float puffSize; uniform float height; void main(){vec4 p=modelViewMatrix*vec4(position,1.0);gl_PointSize=min(140.0,puffSize*height/max(.1,-p.z));gl_Position=projectionMatrix*p;}',
      fragmentShader:'uniform float opacity; void main(){vec2 p=(gl_PointCoord-.5)*vec2(1.0,1.55);float r=length(p)*2.0;float soft=pow(max(0.0,1.0-r*r),3.0);gl_FragColor=vec4(.58,.51,.38,soft*opacity);}' });
    this.dust=new THREE.Points(geometry,material);this.dust.frustumCulled=false;this.dust.visible=false;this.root.add(this.dust);
  }
  update(frame,height){
    this.shadow.material.uniforms.strength.value=.38*frame.shadow;
    const p=frame.dust;this.dust.visible=frame.phase==='contact'||frame.phase==='dust';
    if(!this.dust.visible)return;
    const positions=this.dust.geometry.attributes.position,sizes=this.dust.geometry.attributes.puffSize;
    for(let i=0;i<ARRIVAL.particles;i++){const a=dustParticle(i,p);positions.setXYZ(i,a.x,this.floor+a.y,a.z);sizes.setX(i,a.size*(.7+p*1.7));}
    positions.needsUpdate=true;sizes.needsUpdate=true;
    this.dust.material.uniforms.height.value=height;
    this.dust.material.uniforms.opacity.value=.24*Math.min(1,p*16+.08)*Math.pow(1-p,1.3);
  }
  dispose(){for(const object of [this.shadow,this.dust]){object.geometry.dispose();object.material.dispose();}this.root.removeFromParent();}
}
