import {t,tr} from './i18n.mjs';
import * as THREE from './vendor/three.module.min.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {loadObservationGeometry,ANCHORS} from './geometry.mjs';
import {createBronzeEnvironment} from './lighting.mjs';
import {HomeGesture,homeCameraFit,homeStrikeRegion} from './home-interaction.mjs';
import {BELL_PARTS,bellPart,classifyBellPart} from './data/bell-structure.mjs';
import {sectionCapGeometry} from './section-cap.mjs';
import {ARRIVAL,arrivalFrame} from './home-arrival.mjs';
import {HomeLanding} from './home-landing.mjs';
import {loadBellImage} from './image-resource.mjs';
import {homeMalletFeedback,drawHomeMallet} from './strike-feedback.mjs';

// One GLB bell. Homepage arrival is finite; inspection has no entrance motion.
// No rack, shadow-map pass, postprocessing or idle damping loop is loaded here.
export class HomeBellScene {
  constructor(host,{audio,bytes,onError=()=>{},onStrike=()=>{},onContext=()=>{},purpose='audition',onInspect=()=>{},intro=true,onProject=()=>{},onArrivalAudio=()=>{}}){
    Object.assign(this,{host,audio,onError,onStrike,onContext,purpose,onInspect,frames:0,raf:0,disposed:false,lost:false,interactive:false,impacts:[],mallets:[]});
    try{
    this.focusHost=host.closest('.home-object');this.stageHost=host.closest('.home-screen')||this.focusHost;
    this.onProject=onProject;this.onArrivalAudio=onArrivalAudio;this.intro=intro;this.impactHandled=!intro;
    this.gesture=new HomeGesture();this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(32,1,.05,60);
    this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
    this.renderer.setClearColor(0x000000,0);this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.2;
    this.renderer.debug.onShaderError=()=>{this.shaderFailure=new Error('WebGL shader failed');};
    this.canvas=this.renderer.domElement;this.canvas.tabIndex=0;
    this.canvas.setAttribute('aria-label',t('可滑动旋转的单口 3D 编钟；方向键旋转，Shift 加方向键平移，加减键缩放，Home 恢复正面'));
    this.canvas.title=t('拖动旋转，滚轮缩放，右键拖动或 Shift＋方向键平移');
    host.dataset.renderer='home-webgl';host.dataset.audioNotesStarted='0';host.append(this.canvas);
    this.environment=createBronzeEnvironment(this.renderer);this.scene.environment=this.environment.texture;
    // Match the hall's upper-left sunbeam: a warm key, restrained cool bounce,
    // and a darker right return. No shadow-map pass or idle light animation.
    this.scene.add(new THREE.HemisphereLight('#eee2c7','#34483e',1.25));
    const light=(color,intensity,x,y,z)=>{const source=new THREE.DirectionalLight(color,intensity);source.position.set(x,y,z);this.scene.add(source);};
    light('#f2e1c0',3.8,-3.8,4,3);light('#b8cec5',1.35,3,1,-2);light('#e5d5b2',.5,3,2,5);
    // Only the actual bell owns gestures; the background remains still.
    this.input=this.focusHost;this.canvas.tabIndex=-1;this.canvas.setAttribute('aria-hidden','true');
    this.gate=event=>{
      // OrbitControls must not capture the pointer used by the 3D switch.
      if(event.target.closest('button,input,a,select,.model-mode-controls')){event.stopImmediatePropagation();return;}
      if(!this.interactive)return;
      if(this.gesture.pointers.size)return;
      if(!this.mesh){event.stopImmediatePropagation();return;}
      const r=this.canvas.getBoundingClientRect();
      this.raycaster.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2),this.camera);
      if(!this.raycaster.intersectObject(this.mesh).length)event.stopImmediatePropagation();
    };
    this.input.addEventListener('pointerdown',this.gate,true);this.input.addEventListener('wheel',this.gate,true);
    this.controls=new OrbitControls(this.camera,this.input);this.controls.enabled=false;this.controls.enablePan=true;this.controls.enableDamping=false;
    this.controls.rotateSpeed=.48;this.controls.minPolarAngle=Math.PI*.08;this.controls.maxPolarAngle=Math.PI*.92;
    this.controls.addEventListener('change',this.onChange=()=>this.invalidate());
    this.raycaster=new THREE.Raycaster();
    this.ring=new THREE.Mesh(new THREE.RingGeometry(.045,.052,40),new THREE.MeshBasicMaterial({color:'#c5a45d',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));
    this.ring.visible=false;this.scene.add(this.ring);
    // Physical inscriptions belong to the model; modern audition pitches stay
    // in the controls, leaving the observed artifact unobstructed.
    this.labels=[];
    if(purpose==='inspect'){
      this.canvas.setAttribute('aria-label',t('可旋转的编钟结构模型；轻点部位查看说明，方向键旋转，Shift 加方向键平移'));
      this.partMarker=document.createElement('span');this.partMarker.className='structure-marker';this.partMarker.setAttribute('aria-hidden','true');this.partMarker.hidden=true;host.append(this.partMarker);
      this.renderer.localClippingEnabled=true;
    }
    this.handlers={
      pointerdown:event=>{if(!this.interactive||event.target.closest('button,input,a,select')||document.hidden||this.lost)return;this.finishArrival();if(event.button!==0)return;this.gesture.start(event);this.publish();},
      wheel:()=>{if(this.interactive)this.finishArrival();},
      pointermove:event=>{this.gesture.move(event);},
      pointerup:event=>{const tap=this.gesture.end(event);this.publish();if(tap)this.tap(tap.x,tap.y);},
      pointercancel:event=>{this.gesture.end(event,true);this.publish();},
      lostpointercapture:event=>{this.gesture.end(event,true);this.publish();},
      keydown:event=>{
        if(!this.interactive||event.target.closest('button,input,a,select'))return;
        this.finishArrival();
        if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
          if(event.shiftKey){
            event.preventDefault();
            const amount=this.camera.position.distanceTo(this.controls.target)*.055;
            const direction=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,event.key==='ArrowLeft'||event.key==='ArrowRight'?0:1);
            direction.multiplyScalar(amount*(event.key==='ArrowLeft'||event.key==='ArrowDown'?-1:1));
            this.camera.position.add(direction);this.controls.target.add(direction);this.controls.update();this.invalidate();return;
          }
          event.preventDefault();const offset=this.camera.position.clone().sub(this.controls.target),s=new THREE.Spherical().setFromVector3(offset);
          if(event.key==='ArrowLeft')s.theta-=.17;if(event.key==='ArrowRight')s.theta+=.17;
          if(event.key==='ArrowUp')s.phi=Math.max(Math.PI*.08,s.phi-.12);if(event.key==='ArrowDown')s.phi=Math.min(Math.PI*.92,s.phi+.12);
          this.camera.position.copy(this.controls.target).add(offset.setFromSpherical(s));this.controls.update();this.invalidate();
        }else if(['+','=','-','Home'].includes(event.key)){event.preventDefault();event.key==='Home'?this.reset():this.zoomBy(event.key==='-'?.84:1.19);}
      },
      webglcontextlost:event=>{event.preventDefault();this.lost=true;this.cancel();this.onContext(false);},
      webglcontextrestored:()=>{this.lost=false;this.onContext(true);this.invalidate();},
    };
    for(const [type,handler] of Object.entries(this.handlers))this.input.addEventListener(type,handler);
    this.canvas.addEventListener('webglcontextlost',this.handlers.webglcontextlost);this.canvas.addEventListener('webglcontextrestored',this.handlers.webglcontextrestored);
    this.onHidden=()=>{if(document.hidden)this.cancel();else this.invalidate();};this.onBlur=()=>this.cancel();
    document.addEventListener('visibilitychange',this.onHidden);window.addEventListener('blur',this.onBlur);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(this.focusHost);this.observer.observe(this.stageHost);
    this.ready=loadObservationGeometry({bytes}).then(asset=>{
      if(this.disposed){asset.dispose();return;}
      this.asset=asset;asset.geometry.computeBoundingBox();this.sourceBounds=asset.geometry.boundingBox.clone();
      this.sourceCenter=this.sourceBounds.getCenter(new THREE.Vector3());const size=this.sourceBounds.getSize(new THREE.Vector3());
      asset.geometry.translate(-this.sourceCenter.x,-this.sourceCenter.y,-this.sourceCenter.z);
      this.material=asset.material.clone();this.material.envMapIntensity=.85;
      this.mesh=new THREE.Mesh(asset.geometry,this.material);this.mesh.scale.setScalar(2/size.y);this.scene.add(this.mesh);
      this.modelSize=size.multiplyScalar(2/size.y);
      if(this.purpose==='audition'){
        const fallback=document.createElement('canvas');fallback.width=143;fallback.height=640;
        const ctx=fallback.getContext('2d');ctx.translate(143/2,640*.14);drawHomeMallet(ctx,null,640);
        this.malletTexture=new THREE.CanvasTexture(fallback);this.malletTexture.colorSpace=THREE.SRGBColorSpace;
        this.mallets=Array.from({length:3},()=>{
          const material=new THREE.SpriteMaterial({map:this.malletTexture,transparent:true,toneMapped:false,depthTest:false,depthWrite:false,sizeAttenuation:false});
          const mallet=new THREE.Sprite(material);mallet.center.set(.5,.86);mallet.visible=false;mallet.renderOrder=10;this.scene.add(mallet);return mallet;
        });
        this.host.dataset.malletSource='local-outline';
        loadBellImage('mallet').then(({image,url})=>{
          if(this.disposed)return;
          const texture=new THREE.Texture(image);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
          this.mallets.forEach(mallet=>{mallet.material.map=texture;mallet.material.needsUpdate=true;});
          this.malletTexture.dispose();this.malletTexture=texture;this.host.dataset.malletSource=url.split('/').pop();this.invalidate();
        }).catch(()=>{});
        this.landing=new HomeLanding(this.scene,-1);this.arriving=intro&&!this.reduced;this.arrivalStart=null;
        if(intro)this.audio?.prepareArrival();
        this.mesh.position.y=arrivalFrame(0,this.reduced||!intro).offset;
      }
      // Remove the loading state only after the first genuine 3D frame exists.
      return new Promise((resolve,reject)=>{this.firstFrame=resolve;this.firstFrameReject=reject;this.resize(true);this.publish();});
    });
    }catch(error){
      this.dispose();if(/WebGL|context/i.test(error.message))error.code='WEBGL_UNAVAILABLE';throw error;
    }
  }
  setInteractive(value){this.interactive=value;this.controls.enabled=value;if(value){this.input.tabIndex=0;this.input.setAttribute('role','group');this.refreshLanguage();}}
  refreshLanguage(){
    const label=this.purpose==='inspect'?t('可旋转的编钟结构模型；轻点部位查看说明，方向键旋转，Shift 加方向键平移'):t('可滑动旋转的单口 3D 编钟；方向键旋转，Shift 加方向键平移，加减键缩放，Home 恢复正面');
    this.canvas.setAttribute('aria-label',label);this.input.setAttribute('aria-label',label);
    this.canvas.title=t('拖动旋转，滚轮缩放，右键拖动或 Shift＋方向键平移');
    if(this.partMarker&&this.selectedPart)this.partMarker.textContent=t(bellPart(this.selectedPart).name);
    this.invalidate();
  }
  resize(reset=false){
    if(this.disposed||!this.mesh)return;
    const bounds=this.focusHost.getBoundingClientRect(),stage=this.host.getBoundingClientRect();
    const width=Math.max(1,stage.width),height=Math.max(1,stage.height);
    const key=`${width}:${height}:${bounds.left}:${bounds.top}:${bounds.width}:${bounds.height}`;if(!reset&&key===this.sizeKey)return;this.sizeKey=key;
    const previous=this.distance,fit=homeCameraFit(bounds.width,bounds.height,this.modelSize),offset=this.camera.position.clone().sub(this.controls.target),ratio=previous?offset.length()/previous:1;
    this.width=width;this.height=height;this.distance=fit.distance;this.camera.fov=fit.fov;
    // Extend the original resting frame to the entire page. Off-axis projection
    // keeps the bell in the left light, but zoom no longer hits a local scissor.
    this.camera.setViewOffset(bounds.width,bounds.height,stage.left-bounds.left,stage.top-bounds.top,width,height);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25,Math.sqrt(2400000/(width*height))));
    this.renderer.setSize(width,height);this.camera.updateProjectionMatrix();
    this.controls.minDistance=this.distance*.45;this.controls.maxDistance=this.distance*1.65;
    if(reset||!previous)this.reset();else{this.camera.position.copy(this.controls.target).add(offset.normalize().multiplyScalar(this.distance*ratio));this.controls.update();this.invalidate();}
  }
  reset(){
    if(!this.mesh)return;
    this.finishArrival();
    const yaw=this.purpose==='audition'?-.56:-.44;this.host.dataset.study='overview';this.controls.target.set(0,0,0);
    this.camera.position.set(Math.sin(yaw)*this.distance,this.distance*(this.purpose==='audition'?-.24:-.10),Math.cos(yaw)*this.distance);
    this.controls.update();this.invalidate();
  }
  focusDetail(kind){
    if(!this.mesh||this.disposed||this.lost)return;
    this.finishArrival();
    const cavity=kind==='cavity';this.host.dataset.study=cavity?'cavity':'relief';
    // Presentation viewpoints of the existing mesh, not simulated sound modes.
    this.controls.target.set(0,cavity?-.72:-.18,0);
    const distance=this.distance*.65,phi=cavity?2.42:1.48,theta=cavity?.2:-.32;
    this.camera.position.setFromSphericalCoords(distance,phi,theta).add(this.controls.target);
    this.controls.update();this.invalidate();
  }
  zoomBy(factor){
    if(!this.mesh||this.disposed)return;
    this.finishArrival();
    const offset=this.camera.position.clone().sub(this.controls.target),distance=THREE.MathUtils.clamp(offset.length()/factor,this.controls.minDistance,this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(offset.setLength(distance));this.controls.update();this.invalidate();
  }
  setCutaway(enabled){
    if(!this.mesh)return;
    this.cutPlane=enabled?new THREE.Plane(new THREE.Vector3(0,0,-1),0):null;
    this.material.clippingPlanes=this.cutPlane?[this.cutPlane]:[];this.material.needsUpdate=true;this.invalidate();
    if(enabled&&!this.sectionCap){
      const geometry=sectionCapGeometry(this.mesh.geometry),material=new THREE.MeshStandardMaterial({color:'#6d675b',metalness:.25,roughness:.78,side:THREE.DoubleSide});
      this.sectionCap=new THREE.Mesh(geometry,material);this.sectionCap.scale.copy(this.mesh.scale);this.sectionCap.position.z=.0003;this.scene.add(this.sectionCap);
      this.host.dataset.sectionLoops=String(geometry.userData.loops);this.host.dataset.sectionOpenChains=String(geometry.userData.openChains);
    }
    if(this.sectionCap)this.sectionCap.visible=enabled;
  }
  viewCutaway(){
    if(!this.mesh)return;
    this.controls.target.set(0,0,0);
    this.camera.position.setFromSphericalCoords(this.distance*1.06,1.40,.38).add(this.controls.target);this.controls.update();this.invalidate();
  }
  viewSide(){
    if(!this.mesh)return;this.controls.target.set(0,-.15,0);
    this.camera.position.setFromSphericalCoords(this.distance,1.43,1.18).add(this.controls.target);this.controls.update();this.invalidate();
  }
  selectPart(id,focus=false,point=null,normal=null){
    if(!this.mesh||this.purpose!=='inspect')return;
    if(id==='overview'){this.partPoint=null;this.partMarker.hidden=true;this.host.dataset.selectedPart='overview';this.reset();this.onInspect('overview');return;}
    const part=bellPart(id);this.selectedPart=part.id;this.host.dataset.selectedPart=part.id;
    this.partMarker.textContent=t(part.name);
    if(focus){
      this.setCutaway(false);
      if(part.view==='cavity')this.focusDetail('cavity');
      else{
        const target=this.mesh.localToWorld(this.local(part.anchor));this.controls.target.copy(target);
        const phi=part.view==='upper'?1.08:part.view==='lower'?1.80:1.46,theta=part.view==='back'?Math.PI-.40:part.view==='side'?.86:-.26;
        this.camera.position.setFromSphericalCoords(this.distance*.66,phi,theta).add(target);this.controls.update();
      }
    }
    this.scene.updateMatrixWorld(true);this.camera.updateMatrixWorld(true);
    if(!point){
      const anchor=this.mesh.localToWorld(this.local(part.anchor)),p=anchor.clone().project(this.camera);
      this.raycaster.setFromCamera(new THREE.Vector2(p.x,p.y),this.camera);
      const hit=this.visibleHits()[0];point=hit?.point||anchor;normal=hit?hit.face.normal.clone().transformDirection(this.mesh.matrixWorld):this.camera.position.clone().sub(anchor).normalize();
    }
    this.partPoint=this.mesh.worldToLocal(point.clone());this.partNormal=normal;this.onInspect(part.id);this.invalidate();
  }
  visibleHits(){return this.raycaster.intersectObject(this.mesh).filter(hit=>!this.cutPlane||this.cutPlane.distanceToPoint(hit.point)>=0);}
  local(anchor){return new THREE.Vector3(...anchor).sub(this.sourceCenter);}
  projected(anchor){const point=this.mesh.localToWorld(this.local(anchor)).project(this.camera);return {x:(point.x+1)*this.width/2,y:(1-point.y)*this.height/2};}
  strikeProjection(region){return this.projected(ANCHORS[region==='center'?'strikeCenter':region==='left'?'strikeLeft':'strikeRight']);}
  tap(x,y){
    if(!this.mesh||this.disposed||this.lost||document.hidden)return;
    const bounds=this.canvas.getBoundingClientRect();this.raycaster.setFromCamera(new THREE.Vector2((x-bounds.left)/bounds.width*2-1,1-(y-bounds.top)/bounds.height*2),this.camera);
    const hit=this.purpose==='inspect'?this.visibleHits()[0]:this.raycaster.intersectObject(this.mesh)[0];if(!hit)return;
    const local=this.mesh.worldToLocal(hit.point.clone()).add(this.sourceCenter),size=this.sourceBounds.getSize(new THREE.Vector3());
    if(this.purpose==='inspect'){
      const id=classifyBellPart(local,hit.face.normal);if(id)this.selectPart(id,false,hit.point,hit.face.normal.clone().transformDirection(this.mesh.matrixWorld));return;
    }
    const region=homeStrikeRegion((local.x-this.sourceBounds.min.x)/size.x,(this.sourceBounds.max.y-local.y)/size.y);
    if(region)this.strike(region,hit.point,hit.face.normal.clone().transformDirection(this.mesh.matrixWorld));
  }
  strike(region,point,normal){
    if(this.disposed||document.hidden)return;
    this.finishArrival();
    const midi=region==='center'?60:64;this.host.dataset.lastMidi=String(midi);this.host.dataset.lastRegion=region;
    this.audio.strike(midi).then(started=>{if(!this.disposed&&started){this.host.dataset.audioNotesStarted=String(this.audio.count);}}).catch(()=>{});
    this.onStrike({midi,region});
    if(this.mesh){
      // The refined shell has more depth. Button auditions must hit its actual
      // visible surface rather than placing a ring behind an old flat anchor.
      let contact=point,direction=normal;
      if(!contact){
        const anchor=this.mesh.localToWorld(this.local(ANCHORS[region==='center'?'strikeCenter':region==='left'?'strikeLeft':'strikeRight']));
        const projected=anchor.clone().project(this.camera);this.raycaster.setFromCamera(new THREE.Vector2(projected.x,projected.y),this.camera);
        const hit=this.raycaster.intersectObject(this.mesh)[0];
        contact=hit?.point||anchor;direction=hit?hit.face.normal.clone().transformDirection(this.mesh.matrixWorld):new THREE.Vector3(0,0,1);
      }
      this.ring.position.copy(contact).addScaledVector(direction,.007);
      this.ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);this.feedback=performance.now();
      this.impacts.push({point:contact.clone(),region,at:this.feedback});this.impacts=this.impacts.slice(-3);
      clearTimeout(this.feedbackTimer);this.feedbackTimer=setTimeout(()=>{this.feedback=null;this.invalidate();},650);this.invalidate();
    }
  }
  cancel(){
    this.finishArrival();
    // Cancel OrbitControls' own pointer state as well as the tap recognizer.
    for(const pointerId of [...this.gesture.pointers.keys()]){
      this.input.dispatchEvent(new PointerEvent('pointercancel',{pointerId}));
      if(this.input.hasPointerCapture(pointerId))this.input.releasePointerCapture(pointerId);
    }
    this.gesture?.clear();this.publish();this.feedback=null;this.impacts=[];clearTimeout(this.feedbackTimer);cancelAnimationFrame(this.raf);this.raf=0;
    if(!this.disposed&&!this.lost&&!document.hidden)this.invalidate();
  }
  invalidate(){if(!this.raf&&!this.disposed&&!this.lost&&!document.hidden)this.raf=requestAnimationFrame(time=>this.render(time));}
  finishArrival(){
    if(!this.arriving)return;
    this.arriving=false;this.mesh.position.y=0;this.host.dataset.arrival='settled';
    this.impactHandled=true;
    this.landing?.update(arrivalFrame(0,true),this.height);this.invalidate();
  }
  replayArrival(){
    if(!this.mesh||this.disposed||this.lost||this.purpose!=='audition')return;
    this.audio?.stopLanding();this.impactHandled=false;this.arriving=!this.reduced;
    this.feedback=null;this.impacts=[];clearTimeout(this.feedbackTimer);this.ring.visible=false;
    this.arrivalStart=null;this.lastArrivalRender=undefined;
    this.host.dataset.arrivalAudio='pending';
    this.mesh.position.y=arrivalFrame(0,this.reduced).offset;this.invalidate();
  }
  render(time){
    try{this.renderFrame(time);}catch(error){this.firstFrameReject?.(error);this.firstFrameReject=null;this.onError(error);}
  }
  renderFrame(time){
    this.raf=0;if(this.disposed||this.lost||document.hidden||!this.mesh)return;
    // High-refresh desktop panels must not multiply the entrance GPU budget.
    const arrivalInterval=time-this.arrivalStart<ARRIVAL.drop?1000/45:1000/30;
    if(this.arriving&&this.lastArrivalRender!==undefined&&time-this.lastArrivalRender<arrivalInterval){this.invalidate();return;}
    this.lastArrivalRender=time;
    if(this.landing){
      if(this.arrivalStart===null)this.arrivalStart=time;
      const frame=arrivalFrame(this.arriving?time-this.arrivalStart:0,!this.arriving);
      this.mesh.position.y=frame.offset;this.host.dataset.arrival=frame.phase;this.host.dataset.dust=String(frame.dust);
      if(!this.impactHandled&&frame.phase!=='descending'){
        this.impactHandled=true;
        const played=this.audio?.landing(ARRIVAL.dust/1000)===true;
        this.host.dataset.arrivalAudio=played?'playing':'blocked';
        this.host.dataset.landingSounds=String(this.audio?.landingCount||0);
        this.onArrivalAudio(played?'playing':'blocked');
      }
      if(!frame.active&&this.host.dataset.arrivalAudio==='playing'){
        this.host.dataset.arrivalAudio='decayed';this.onArrivalAudio('decayed');
      }
      this.landing.update(frame,this.height);this.arriving=frame.active;
    }
    const progress=this.feedback===null||this.feedback===undefined?1:Math.min(1,(time-this.feedback)/650);
    this.ring.visible=progress<1;this.ring.scale.setScalar(this.reduced?1:1+progress*3);this.ring.material.opacity=this.reduced?.65:.7*(1-progress);
    this.material.emissive.set('#c5a45d');this.material.emissiveIntensity=progress<1?.025*(1-progress):0;
    this.impacts=this.impacts.filter(impact=>time-impact.at<650);
    this.camera.updateMatrixWorld(true);this.malletFrames=[];
    this.mallets.forEach((mallet,index)=>{
      const impact=this.impacts[index];mallet.visible=!!impact&&!this.reduced;
      if(!mallet.visible)return;
      const feedback=homeMalletFeedback(time-impact.at,this.focusHost.getBoundingClientRect().width);
      mallet.visible=feedback.alpha>0;mallet.material.opacity=feedback.alpha;
      // Project the real contact, then apply the same pixel recoil as 2D.
      // A camera-facing sprite keeps the engraved copper art legible at any yaw.
      const point=impact.point.clone().project(this.camera),side=impact.region==='left'?-1:1;
      point.x+=side*feedback.offsetX*2/this.width;point.y-=feedback.offsetY*2/this.height;
      mallet.position.copy(point.clone().unproject(this.camera));
      mallet.scale.set(feedback.width*2/(this.width*this.camera.projectionMatrix.elements[0]),feedback.height*2/(this.height*this.camera.projectionMatrix.elements[5]),1);
      this.host.dataset.malletHeight=String(feedback.height);
      if(mallet.visible)this.malletFrames.push({region:impact.region,x:(point.x+1)*this.width/2,y:(1-point.y)*this.height/2,width:feedback.width,height:feedback.height,alpha:feedback.alpha});
    });
    this.scene.updateMatrixWorld(true);this.camera.updateMatrixWorld(true);
    const direction=this.camera.position.clone().sub(this.controls.target).normalize(),front=!this.arriving&&direction.z>.12&&this.host.dataset.study!=='cavity';
    for(const label of this.labels){
      const p=this.projected(label.anchor);label.element.hidden=!front||p.x<8||p.x>this.width-8||p.y<8||p.y>this.height-8;
      label.element.style.left=`${p.x}px`;label.element.style.top=`${p.y}px`;
    }
    if(this.partMarker&&this.partPoint){
      const point=this.mesh.localToWorld(this.partPoint.clone()),projected=point.clone().project(this.camera),toward=this.camera.position.clone().sub(point).normalize();
      this.partMarker.hidden=this.partNormal.dot(toward)<.02||!!this.cutPlane&&this.cutPlane.distanceToPoint(point)<0||Math.abs(projected.x)>1||Math.abs(projected.y)>1;
      this.partMarker.style.left=`${(projected.x+1)*this.width/2}px`;this.partMarker.style.top=`${(1-projected.y)*this.height/2}px`;
    }
    this.renderer.render(this.scene,this.camera);if(this.shaderFailure)throw this.shaderFailure;this.frames++;this.publish();
    if(this.firstFrame){this.firstFrame();this.firstFrame=null;this.firstFrameReject=null;}
    if(this.arriving||progress<1&&!this.reduced)this.invalidate();
  }
  publish(){
    this.host.dataset.activePointers=String(this.gesture.pointers.size);this.host.dataset.frames=String(this.frames);
    if(!this.mesh)return;
    this.host.dataset.triangles=String(this.renderer.info.render.triangles);this.host.dataset.modelCount='1';
    this.host.dataset.drawCalls=String(this.renderer.info.render.calls);
    this.host.dataset.malletCount=String(this.mallets.filter(mallet=>mallet.visible).length);
    this.host.dataset.malletFrames=JSON.stringify(this.malletFrames||[]);
    this.stageHost.dataset.enlarged=String(this.camera.position.distanceTo(this.controls.target)<this.distance*.9);
    this.host.dataset.camera=JSON.stringify({position:this.camera.position.toArray(),target:this.controls.target.toArray(),distance:this.camera.position.distanceTo(this.controls.target)});
    this.host.dataset.contacts=JSON.stringify(['center','left','right'].map(region=>({region,midi:region==='center'?60:64,...this.projected(ANCHORS[region==='center'?'strikeCenter':region==='left'?'strikeLeft':'strikeRight'])})));
    if(this.purpose==='inspect')this.host.dataset.partContacts=JSON.stringify(BELL_PARTS.map(part=>({id:part.id,...this.projected(part.anchor)})));
    const corners=[];for(const x of [this.sourceBounds.min.x,this.sourceBounds.max.x])for(const y of [this.sourceBounds.min.y,this.sourceBounds.max.y])for(const z of [this.sourceBounds.min.z,this.sourceBounds.max.z])corners.push(this.projected([x,y,z]));
    this.host.dataset.modelBounds=JSON.stringify({left:Math.min(...corners.map(p=>p.x)),top:Math.min(...corners.map(p=>p.y)),right:Math.max(...corners.map(p=>p.x)),bottom:Math.max(...corners.map(p=>p.y))});
    this.onProject(this);
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.cancel();this.firstFrameReject?.(new DOMException('Cancelled','AbortError'));this.firstFrameReject=null;
    this.observer?.disconnect();this.controls?.removeEventListener('change',this.onChange);this.controls?.dispose();
    for(const [type,handler] of Object.entries(this.handlers||{}))this.input?.removeEventListener(type,handler);
    this.input?.removeEventListener('pointerdown',this.gate,true);this.input?.removeEventListener('wheel',this.gate,true);
    if(this.handlers){this.canvas?.removeEventListener('webglcontextlost',this.handlers.webglcontextlost);this.canvas?.removeEventListener('webglcontextrestored',this.handlers.webglcontextrestored);}
    document.removeEventListener('visibilitychange',this.onHidden);window.removeEventListener('blur',this.onBlur);
    this.material?.dispose();this.asset?.dispose();this.environment?.dispose();this.ring?.geometry.dispose();this.ring?.material.dispose();
    this.mallets.forEach(mallet=>mallet.material.dispose());this.malletTexture?.dispose();
    this.sectionCap?.geometry.dispose();this.sectionCap?.material.dispose();
    this.landing?.dispose();
    this.renderer?.dispose();this.renderer?.forceContextLoss();this.canvas?.remove();this.labels?.forEach(label=>label.element.remove());this.partMarker?.remove();
    this.host.dataset.activePointers='0';this.host.dataset.disposed='true';
  }
}
