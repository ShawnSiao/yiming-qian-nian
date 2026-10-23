import * as THREE from './vendor/three.module.min.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { BellAudio } from './audio.mjs';
import { bellAt, bellForMidi, resolveStrikeRegion, bellSize, octaveSize, SIZE_STUDY, strikeMotion, chooseLayout, performanceFocus, touchTargets, validateTargets, PALETTE } from './model.mjs';
import { createRack, loadObservationGeometry, frameCamera, performanceCamera, suspensionPoint, SUSPENSION, ANCHORS, STRIKE_REGIONS, STRIKE_ANCHORS, BELL_YAW, BELL_TILT, BELL_TOP, BODY_TOP, FOCUS_TOP, MALLET_TIP } from './geometry.mjs';
import { createBronzeEnvironment } from './lighting.mjs';

export class BellScene {
  constructor(host, { onMeasure, onStrike, onMessage, onRegisterChange=()=>{}, onInterrupt=()=>{}, geometry, audio, initialMode='play' }) {
    this.host = host;
    this.onMeasure = onMeasure;
    this.onStrike = onStrike;
    this.onMessage = onMessage;
    this.onRegisterChange=onRegisterChange;
    this.onInterrupt=onInterrupt;
    this.options = { mode: initialMode, choice: 'auto', startOctave: 4, labels: true, diagnostics: false, muted: false, inspect: true, cutaway: false, active:true };
    this.bells = [];
    this.targets = [];
    this.bodies = [];
    this.effects = new Map();
    this.pointers = new Map();
    this.history = [];
    this.frames = 0;
    this.raf = 0;
    this.lastFrame = 0;
    this.disposed = false;
    this.lost = false;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.audio = audio || new BellAudio();
    this.ownsAudio = !audio;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1,matchMedia('(pointer: coarse)').matches||Math.min(innerWidth,innerHeight)<600?1.25:1.5));
    this.renderer.setClearColor('#171e1a');
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.75;
    this.renderer.localClippingEnabled = true;
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate=false;
    this.canvas = this.renderer.domElement;
    this.canvas.setAttribute('aria-label', '可旋转的曾侯乙编钟参考模型');
    this.canvas.setAttribute('role', 'img');
    this.raycaster = new THREE.Raycaster();
    this.canvas.addEventListener('pointerdown', this.handleBodyTap = event => {
      if (this.options.mode!=='play' || !this.options.active || event.button!==0 || document.hidden || this.lost || this.pointers.has(event.pointerId)) return;
      const bounds=this.canvas.getBoundingClientRect();
      const pointer=new THREE.Vector2((event.clientX-bounds.left)/bounds.width*2-1,1-(event.clientY-bounds.top)/bounds.height*2);
      this.raycaster.setFromCamera(pointer,this.camera);
      const nearby=this.bells.filter(b=>{const box=this.bodies.find(body=>body.id===b.data.id);return box&&event.clientX-bounds.left>=box.x-3&&event.clientX-bounds.left<=box.x+box.width+3&&event.clientY-bounds.top>=box.y-3&&event.clientY-bounds.top<=box.y+box.height+3;});
      const hit=this.raycaster.intersectObjects(nearby.map(b=>b.mesh),false)[0];
      if (!hit) return;
      const bell=this.bells.find(b=>b.mesh===hit.object);
      const point=bell.mesh.worldToLocal(hit.point.clone());
      point.divideScalar(bell.modelRatio);
      if(point.y>BODY_TOP) return;
      event.preventDefault();
      this.canvas.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId,this.canvas);
      this.surface.dataset.activePointers=String(this.pointers.size);
      this.strike(bell,Math.abs(point.x)>.105?(point.x<0?'left':'right'):'center','bell-surface');
    });
    this.handleBodyRelease=event=>{this.pointers.delete(event.pointerId);this.surface.dataset.activePointers=String(this.pointers.size);if(this.canvas.hasPointerCapture(event.pointerId))this.canvas.releasePointerCapture(event.pointerId);};
    for(const type of ['pointerup','pointercancel','lostpointercapture'])this.canvas.addEventListener(type,this.handleBodyRelease);
    this.canvas.addEventListener('webglcontextlost', this.handleLost = event => {
      event.preventDefault(); this.lost = true; this.cancelInput(true);
      this.onMessage('3D 画面暂时中断，等待浏览器恢复。');
    });
    this.canvas.addEventListener('webglcontextrestored', this.handleRestore = () => {
      this.lost = false; this.onMessage('3D 画面已恢复，可重新敲击。'); this.invalidate();
    });
    this.surface = document.createElement('div');
    this.surface.className = 'scene-surface';
    this.overlay = document.createElement('div');
    this.overlay.className = 'scene-overlay';
    this.surface.append(this.canvas, this.overlay);
    host.append(this.surface);
    this.scene = new THREE.Scene();
    this.environment=createBronzeEnvironment(this.renderer);
    this.scene.environment=this.environment.texture;
    this.scene.environmentIntensity=.9;
    this.scene.add(new THREE.HemisphereLight('#b9cdc2', '#101a15', .5));
    const light = new THREE.DirectionalLight('#f1e4ce', 3.8);
    light.position.set(-450, 550, 600);
    light.castShadow=true;
    const shadowSize=matchMedia('(pointer: coarse)').matches||Math.min(innerWidth,innerHeight)<600?1024:2048;
    light.shadow.mapSize.set(shadowSize,shadowSize);light.shadow.normalBias=.30;light.shadow.bias=-.00015;
    light.shadow.radius=4;light.shadow.intensity=.26;
    this.keyLight=light;
    this.scene.add(light);
    const edge = new THREE.DirectionalLight('#b5c7d0', 2.2);
    edge.position.set(400, 200, -120);
    this.scene.add(edge);
    const fill=new THREE.DirectionalLight('#b5c7d0',.85);fill.position.set(350,-100,450);this.scene.add(fill);
    this.stage = new THREE.Group();
    this.scene.add(this.stage);
    this.camera = new THREE.PerspectiveCamera(30, 2, 1, 4000);
    this.camera.position.set(0, 0, 1200);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enablePan = false;
    this.controls.enableDamping = false;
    this.controls.rotateSpeed = 0.36;
    this.controls.minZoom = 0.6;
    this.controls.maxZoom = 4;
    this.controls.minDistance = 400;
    this.controls.maxDistance = 2400;
    this.controls.minPolarAngle = Math.PI * 0.06;
    this.controls.maxPolarAngle = Math.PI * 0.94;
    this.controls.addEventListener('change', this.handleCamera = () => {
      this.updateAnnotations(false); this.invalidate();
    });
    this.assets = geometry;
    this.geometries=[...'CDEFGAB'].map(n=>geometry['Bell_'+n].children[0].geometry);
    this.geometry = this.geometries[0];
    this.bodyMaterial = geometry.Bell_C.children[0].material;
    this.bodyMaterial.side = THREE.DoubleSide;
    this.bodyMaterial.roughness=.88;this.bodyMaterial.metalness=.90;
    this.bodyMaterial.normalScale?.set(.30,.30);
    this.mallets = Array.from({ length: 6 }, () => {
      const mallet = geometry.CopperMallet.clone(); mallet.visible=false;
      this.scene.add(mallet); return mallet;
    });
    this.handleResize = () => this.resize();
    this.observer = new ResizeObserver(this.handleResize);
    this.observer.observe(host);
    this.handleBlur = () => {this.onInterrupt('blur');this.cancelInput(true);};
    this.handleVisibility = () => {
      this.cancelInput(true);
      if(document.hidden)this.onInterrupt('hidden');
      if (!document.hidden) this.invalidate();
    };
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('visibilitychange', this.handleVisibility);
    this.resize();
  }

  setOptions(next) {
    const before = this.options;
    this.options = { ...before, ...next };
    const structural = ['mode', 'choice', 'startOctave', 'inspect'].some(key => before[key] !== this.options[key]);
    const cutChanged=before.cutaway!==this.options.cutaway;
    this.audio.setMuted(this.options.muted);
    if(before.active!==this.options.active)this.cancelInput(true);
    if(this.options.mode==='observe')this.ensureObservation();
    if (structural) { this.cancelInput(true); this.resize(true); }
    if(cutChanged && !structural && this.options.mode==='observe') {
      for(const bell of this.bells)bell.material.clippingPlanes=this.options.cutaway?[new THREE.Plane(new THREE.Vector3(1,0,0),0)]:[];
    }
    if(this.options.mode==='observe' && this.options.cutaway && (cutChanged||structural))this.viewCutaway();
    this.surface.classList.toggle('show-diagnostics', this.options.diagnostics);
    this.surface.classList.toggle('hide-labels', !this.options.labels);
    this.invalidate();
  }

  resize(force = false) {
    if (this.disposed) return;
    const rect = this.host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);
    const mobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600 || width<900;
    const layout = chooseLayout(width, height, { ...this.options, mobile });
    if (this.options.mode === 'observe') {
      layout.rows = 1; layout.octaves = [layout.low]; layout.cellHeight = height;
      layout.width = width; layout.cellWidth = width; layout.portrait = false;
    }
    const key = `${layout.width}:${layout.height}:${layout.rows}:${layout.low}:${this.options.mode}:${this.options.inspect}`;
    if (!force && this.layoutKey === key) return;
    if(this.layoutKey&&!force)this.onInterrupt('resize');
    this.cancelInput(true);
    this.layoutKey = key;
    this.layout = layout;
    this.surface.style.width = `${layout.width}px`;
    this.surface.style.height = `${layout.height}px`;
    this.renderer.setSize(layout.width, layout.height);
    frameCamera(this.camera,layout.width,layout.height,this.options.mode);
    const shadow=this.keyLight.shadow.camera;
    shadow.left=-layout.width;shadow.right=layout.width;shadow.top=layout.height;shadow.bottom=-layout.height;
    shadow.near=100;shadow.far=2400;shadow.updateProjectionMatrix();
    this.build();
    this.resetCamera();
    // A projected mesh test, not merely a grid-capacity test.
    this.updateAnnotations();
    let issues = validateTargets(this.targets, this.bodies, layout.width, layout.height,layout);
    this.fallbackReasons=[...issues];
    if (this.options.mode === 'play' && issues.length && layout.rows > 1) {
      Object.assign(layout,chooseLayout(width,height,{...this.options,choice:'single',mobile}));layout.fallback=true;
      this.surface.style.width=`${layout.width}px`;this.surface.style.height=`${layout.height}px`;
      this.renderer.setSize(layout.width,layout.height);frameCamera(this.camera,layout.width,layout.height,this.options.mode);
      this.build();
      this.updateAnnotations();
      issues = validateTargets(this.targets, this.bodies, layout.width, layout.height,layout);
    }
    this.issues = this.options.mode === 'play' ? issues : [];
    this.surface.dataset.layout = JSON.stringify({ ...layout, minBodyWidth: Math.min(...this.bodies.map(b => b.width)), minBodyHeight: Math.min(...this.bodies.map(b => b.height)), issues: this.issues });
    this.controls.enabled = this.options.mode === 'observe' && this.options.active;
    this.canvas.setAttribute('aria-label',this.options.mode==='observe'?'可拖动旋转的单口编钟模型':'固定视角的编钟演奏模型，正鼓与左右侧鼓');
    this.surface.dataset.mode = this.options.mode;
    this.invalidate();
    this.onMeasure(this.snapshot());
    this.host.scrollLeft=0;this.host.scrollTop=0;
  }

  build() {
    for (const bell of this.bells) bell.material.dispose();
    this.stage.clear();
    this.overlay.replaceChildren();
    this.bells = [];
    this.targetElements = new Map();
    const layout = this.layout;
    const inspecting = this.options.mode === 'observe';
    const scale = inspecting ? Math.min(layout.width / .62, (layout.height - 20) / BELL_TOP) : layout.scale;
    this.scale = scale;
    this.rack = createRack(this.assets, layout, scale, inspecting);
    this.rack.visible = !inspecting;
    this.stage.add(this.rack);
    // A quiet surface behind the instrument receives static contact shadows.
    if(this.backdrop){this.backdrop.geometry.dispose();this.backdrop.material.dispose();}
    if(this.floor){this.floor.geometry.dispose();this.floor.material.dispose();}
    this.backdrop=new THREE.Mesh(new THREE.PlaneGeometry(layout.width+700,layout.height+500),new THREE.MeshStandardMaterial({color:'#0b1410',roughness:.95,metalness:0}));
    this.backdrop.position.z=-500;this.backdrop.receiveShadow=false;this.stage.add(this.backdrop);
    this.backdrop.visible=!inspecting;
    this.floor=new THREE.Mesh(new THREE.PlaneGeometry(layout.width+700,650),new THREE.MeshStandardMaterial({color:'#151b16',roughness:.73,metalness:.08}));
    this.floor.rotation.x=-Math.PI/2;this.floor.position.set(0,this.rack.userData.floorY??-layout.height/2,-10);
    this.floor.receiveShadow=true;this.floor.visible=!inspecting;this.stage.add(this.floor);
    for (let row = 0; row < layout.rows; row++) {
      const rowFrame=layout.frames[row],rowTop=rowFrame.top;
      const mount=layout.height/2-rowFrame.mount;
      const rowLabel = document.createElement('div');
      rowLabel.className = 'register-label';
      rowLabel.innerHTML = `<span>${layout.octaves[row]}</span><small>音区</small>`;
      rowLabel.style.top = `${rowTop + rowFrame.height / 2}px`;
      rowLabel.hidden = inspecting;
      this.overlay.append(rowLabel);
      for (let col = 0; col < (inspecting ? 1 : 7); col++) {
        const data = bellAt(layout.octaves[row], col);
        const placement=layout.placements?.find(p=>p.row===row&&p.column===col);
        const frameIndex=placement?.frame??row,frame=layout.frames[frameIndex];
        const x = inspecting ? 0 : -layout.width/2+(placement?.x??layout.columns[col].x);
        const group = new THREE.Group();
        const ratio=inspecting?1:SIZE_STUDY.columns[col];
        // Each active register is a focused performance view. Keep the real
        // C–B size study, but compensate octave size in the compact lens so
        // the upper-register touch areas do not become miniature controls.
        const focusFactor=inspecting?1:performanceFocus(layout,row,col);
        const individualScale=inspecting?scale:scale*bellSize(data.octave,col)*focusFactor;
        const objectScale=individualScale/ratio;
        // All sizes hang from the same mount line; their mouths rise as the
        // bells get smaller. Never normalize an individual bell to its cell.
        const bellBase=-scale/2;
        const attachment=inspecting?new THREE.Vector3(x,bellBase+BELL_TOP*individualScale,0):suspensionPoint(layout,row,col);
        group.position.copy(attachment);
        group.scale.setScalar(objectScale);
        if (!inspecting) {
          const mount=layout.height/2-frame.mount;
          const rowZ=(layout.rows-1-row)*SUSPENSION.rowDepth;
          const saddle=this.assets.SuspensionSaddle.clone();
          const hardware=layout.compact?76:200;
          saddle.position.set(x,mount,rowZ-48);saddle.scale.setScalar(hardware);this.stage.add(saddle);
          const eye=new THREE.Vector3(x,mount-.097*hardware,rowZ-48+.091*hardware);
          const hanger=this.assets.SuspensionLink.clone();hanger.position.copy(attachment);
          const direction=eye.clone().sub(attachment);
          hanger.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());
          hanger.scale.set(hardware,direction.length()/.12,hardware);this.stage.add(hanger);
        }
        const observation=inspecting&&this.observation;
        const material = (observation?this.observation.material:this.bodyMaterial).clone();
        material.envMapIntensity=1.35;
        material.clippingPlanes = [];
        if(!inspecting&&layout.compact)material.clippingPlanes=[new THREE.Plane(new THREE.Vector3(0,-1,0),layout.height/2-frame.top-2),new THREE.Plane(new THREE.Vector3(0,1,0),-layout.height/2+frame.top+frame.height)];
        if (inspecting && this.options.cutaway) material.clippingPlanes = [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)];
        const pivot = new THREE.Group();
        pivot.rotation.y = inspecting ? 0 : BELL_YAW;
        pivot.rotation.x = inspecting ? 0 : BELL_TILT;
        const mesh = new THREE.Mesh(observation?this.observation.geometry:this.geometries[inspecting?0:col], material);
        mesh.castShadow=true;mesh.receiveShadow=true;
        if(inspecting)mesh.position.y=-BELL_TOP*ratio;
        else mesh.position.set(...SUSPENSION.pivot.map(v=>-v*ratio));
        pivot.add(mesh);
        group.add(pivot);
        this.stage.add(group);
        const bell = { data, group, pivot, mesh, material, labels: {}, impacts:{}, guides:{}, row, frameIndex, scale: individualScale,modelRatio:ratio,physicalSize:bellSize(data.octave,col) };
        this.bells.push(bell);
        for (const zone of ['center','right']) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = `strike-target ${zone}`;
          button.dataset.bell = data.id;
          button.dataset.zone = zone;
          button.setAttribute('aria-label', `${zone === 'center' ? data.centerName : data.sideName} ${zone === 'center' ? '正鼓' : zone==='left'?'左侧鼓':'右侧鼓'}${data.sameSide && zone !== 'center' ? '，回本音' : ''}`);
          button.innerHTML = `<span class="target-measure" aria-hidden="true">44</span>`;
          button.addEventListener('pointerdown', event => {
            if (event.button !== 0 || this.options.mode !== 'play' || document.hidden || this.lost || this.pointers.has(event.pointerId)) return;
            event.preventDefault();
            button.setPointerCapture(event.pointerId);
            this.pointers.set(event.pointerId, button);
            this.surface.dataset.activePointers = String(this.pointers.size);
            button.classList.add('held');
            this.strike(bell, zone, 'pointer');
          });
          const release = event => {
            this.pointers.delete(event.pointerId);
            this.surface.dataset.activePointers = String(this.pointers.size);
            button.classList.remove('held');
            if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
          };
          button.addEventListener('pointerup', release);
          button.addEventListener('pointercancel', release);
          button.addEventListener('lostpointercapture', release);
          button.addEventListener('keydown', event => {
            if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); this.strike(bell, zone, 'keyboard'); }
          });
          button.addEventListener('click', event => { if (event.detail === 0 && !event.pointerType) this.strike(bell, zone, 'accessibility'); });
          this.targetElements.set(`${data.id}:${zone}`, button);
          this.overlay.append(button);
        }
        const natural = document.createElement('span');
        natural.className = 'note-label natural-note';
        natural.textContent = data.centerName;
        this.overlay.append(natural);
        bell.labels.natural = natural;
        for(const region of STRIKE_REGIONS) {
          const impact = document.createElement('span'),guide=document.createElement('span');
          impact.className = 'physical-impact';guide.className='guide-target';guide.hidden=true;
          impact.setAttribute('aria-hidden', 'true');guide.setAttribute('aria-hidden','true');
          this.overlay.append(impact,guide);
          bell.impacts[region]=impact;bell.guides[region]=guide;
        }
        for (const region of ['right']) {
          const side = document.createElement('span');
          side.className = `note-label side-note ${region}-note`;
          side.textContent = data.sideName;
          side.hidden=data.sameSide;
          this.overlay.append(side);
          bell.labels[region] = side;
        }
      }
    }
    this.stage.updateMatrixWorld(true);
    this.rack.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    this.renderer.shadowMap.needsUpdate=true;
  }

  ensureObservation() {
    if(this.observation||this.observationLoading)return;
    this.observationLoading=true;
    loadObservationGeometry().then(asset=>{
      if(this.disposed){asset.dispose();return;}
      this.observation=asset;this.observationLoading=false;
      if(this.options.mode==='observe'){
        const position=this.camera.position.clone(),target=this.controls.target.clone(),zoom=this.camera.zoom;
        this.resize(true);this.camera.position.copy(position);this.controls.target.copy(target);this.camera.zoom=zoom;
        this.camera.updateProjectionMatrix();this.controls.update();this.invalidate();
      }
    }).catch(()=>{this.observationLoading=false;this.onMessage('细节模型载入失败，可继续旋转当前钟体。');});
  }

  strikeMidi(midi,source='playback',velocity=.85,region) {
    const mapped=bellForMidi(midi);if(!mapped)return;
    // Quiet accompaniment must not pull a single-row mobile view back and
    // forth between bass chords and the melody register.
    if(source==='playback'&&velocity<.45){this.audio.strike(midi,0,velocity).catch(()=>{});return;}
    const bell=this.ensureBell(mapped.bell);
    const contact=resolveStrikeRegion(mapped.bell,midi,region);
    if(bell&&this.options.mode==='play'){this.strike(bell,contact,source,velocity);}
    else this.audio.strike(midi,0,velocity).catch(()=>{});
  }

  setTarget(midi) {
    const mapped=bellForMidi(midi);
    if(mapped)this.ensureBell(mapped.bell);
    this.overlay.querySelectorAll('.expected').forEach(e=>e.classList.remove('expected'));
    for(const bell of this.bells)for(const region of STRIKE_REGIONS)bell.guides[region].hidden=true;
    if(mapped)for(const region of mapped.zone==='center'?['center']:['right']) {
      this.targetElements.get(`${mapped.bell.id}:${region}`)?.classList.add('expected');
      const bell=this.bells.find(b=>b.data.id===mapped.bell.id);
      if(bell){bell.guides[region].hidden=false;}
    }
  }

  setCue(remaining){
    this.overlay.style.setProperty('--cue-progress',String(Math.max(0,Math.min(1,1-remaining/350))));
    for(const guide of this.overlay.querySelectorAll('.guide-target'))guide.classList.toggle('due',remaining<=65&&remaining>=-180);
  }

  ensureBell(data) {
    return this.bells.find(b=>b.data.id===data.id);
  }

  revealBell(bell) {
    // Kept as a no-op for callers from older saved prototype scripts. Active
    // instruments must never move under the player's fingers.
  }

  projectMesh(bell, point) {
    const vector = new THREE.Vector3(...point);
    bell.mesh.localToWorld(vector);
    vector.project(this.camera);
    return { x: (vector.x + 1) * this.layout.width / 2, y: (1 - vector.y) * this.layout.height / 2 };
  }

  projectLocal(bell,point){return this.projectMesh(bell,point.map(v=>v*bell.modelRatio));}

  updateAnnotations(measure = true) {
    if (!this.layout || !this.bells.length) return;
    this.camera.updateMatrixWorld(true);
    this.targets = [];
    if (measure) this.bodies = [];
    for (const bell of this.bells) {
      const points=Object.fromEntries(STRIKE_REGIONS.map(zone=>[zone,this.projectLocal(bell,ANCHORS[zone])]));
      const frame=this.layout.frames[bell.frameIndex];
      const cell=this.layout.placements?.find(p=>p.row===bell.row&&p.column===bell.data.column);
      for (const rect of touchTargets(bell.data.id,points,cell?.width||this.layout.cellWidth,{top:frame.top,bottom:frame.top+frame.height})) {
        const {key,zone}=rect;
        this.targets.push(rect);
        const button = this.targetElements.get(key);
        button.style.left = `${rect.x}px`;
        button.style.top = `${rect.y}px`;
        button.tabIndex = this.options.mode === 'play' ? 0 : -1;
        button.disabled = this.options.mode !== 'play';
      }
      const naturalPoint = this.projectLocal(bell, ANCHORS.naturalLabel);
      bell.labels.natural.style.left = `${naturalPoint.x}px`;
      const rowTop=frame.top;
        bell.labels.natural.style.top = `${Math.max(rowTop+15,naturalPoint.y)}px`;
      for (const region of ['right']) {
        const sidePoint = this.projectLocal(bell, ANCHORS[`${region}Label`]);
        bell.labels[region].style.left = `${sidePoint.x}px`;
        bell.labels[region].style.top = `${Math.min(frame.top+frame.height-12,sidePoint.y)}px`;
      }
      for(const region of STRIKE_REGIONS) {
        const p=this.projectLocal(bell,ANCHORS[STRIKE_ANCHORS[region]]);
        for(const element of [bell.impacts[region]]) {
          element.style.left=`${p.x}px`;element.style.top=`${p.y}px`;
        }
        const proxy=this.targets.find(t=>t.id===bell.data.id&&t.zone===region);
        const guide=bell.guides[region];
        guide.style.left=`${proxy?proxy.x+22:p.x}px`;guide.style.top=`${proxy?proxy.y+22:p.y}px`;
      }
      // Measure actual projected shell vertices, not the surrounding grid cell.
      if (!measure || this.options.mode === 'observe') continue;
      const positions = bell.mesh.geometry.attributes.position;
      let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
      let fullTop=Infinity,fullBottom=-Infinity;
      for (let i = 0; i < positions.count; i++) {
        const y = positions.getY(i);
        const p = this.projectMesh(bell, [positions.getX(i), y, positions.getZ(i)]);
        fullTop=Math.min(fullTop,p.y);fullBottom=Math.max(fullBottom,p.y);
        if (y > (BODY_TOP + .001)*bell.modelRatio) continue;
        xMin = Math.min(xMin, p.x); xMax = Math.max(xMax, p.x);
        yMin = Math.min(yMin, p.y); yMax = Math.max(yMax, p.y);
      }
      this.bodies.push({ id: bell.data.id, x: xMin, y: yMin, width: xMax - xMin, height: yMax - yMin,fullTop,fullBottom });
    }
    this.surface.dataset.targets=JSON.stringify(this.targets);
    this.surface.dataset.bodies=JSON.stringify(this.bodies);
    this.surface.dataset.contacts=JSON.stringify(this.bells.map(bell=>({id:bell.data.id,...Object.fromEntries(STRIKE_REGIONS.map(region=>[region,this.projectLocal(bell,ANCHORS[STRIKE_ANCHORS[region]])]))})));
  }

  strike(bell, region, source, velocity=.85) {
    if (this.options.mode !== 'play' || !this.options.active || document.hidden || this.lost) return;
    if(region==='side')region='right'; // Score / stored pitch compatibility.
    const zone=region==='center'?'center':'side';
    const midi = zone === 'center' ? bell.data.centerMidi : bell.data.sideMidi;
    const name = zone === 'center' ? bell.data.centerName : bell.data.sideName;
    const event = { id: bell.data.id, zone, region, midi, name, source, at: performance.now() };
    this.history.push(event);
    if (this.history.length > 64) this.history.shift();
    this.audio.strike(midi,0,velocity).then(() => {
      this.surface.dataset.audioNotesStarted = String(this.audio.count);
      this.surface.dataset.audioState = this.audio.context?.state || 'not-started';
    }).catch(() => this.onMessage('声音尚未开启，请再次敲击；同时检查手机静音设置。'));
    this.effects.set(`${bell.data.id}:${region}`, { bell, zone, region, at: event.at });
    const element = this.targetElements.get(`${bell.data.id}:${region}`);
    element?.classList.add('struck');
    const impactPoint = this.projectLocal(bell, ANCHORS[STRIKE_ANCHORS[region]]);
    const impact=bell.impacts[region];
    impact.style.left = `${impactPoint.x}px`;
    impact.style.top = `${impactPoint.y}px`;
    impact.classList.remove('impact-active');
    void impact.offsetWidth;
    impact.classList.add('impact-active');
    this.latest = event;
    this.surface.dataset.eventCount = String(this.history.length);
    this.surface.dataset.lastMidi = String(midi);
    this.onStrike(event);
    this.invalidate();
  }

  resetCamera() {
    this.controls.target.set(0, 0, 0);
    performanceCamera(this.camera);
    this.camera.up.set(0, 1, 0);
    this.camera.zoom = 1;
    this.camera.lookAt(0, 0, 0);
    if (this.options.mode === 'observe') {
      this.camera.position.set(720, 220, 1120);
      this.camera.lookAt(0, 0, 0);
      this.camera.zoom = .98;
    }
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.updateAnnotations();
    this.invalidate();
  }

  zoomBy(factor) {
    if (this.options.mode !== 'observe') return;
    this.camera.zoom = Math.max(0.6, Math.min(4, this.camera.zoom * factor));
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.updateAnnotations();
    this.invalidate();
  }

  viewSide() {
    if(this.options.mode!=='observe')return;
    const angle=Math.PI/2;
    this.controls.target.set(0,0,0);this.camera.position.set(Math.sin(angle)*1400,50,Math.cos(angle)*1400);
    this.controls.update();this.updateAnnotations(false);this.invalidate();
  }

  viewFront() {
    if(this.options.mode!=='observe')return;
    this.controls.target.set(0,0,0);this.camera.position.set(0,0,1400);
    this.controls.update();this.updateAnnotations(false);this.invalidate();
  }

  viewInterior() {
    if (this.options.mode !== 'observe') return;
    this.camera.position.set(120, -1000, 620);
    this.controls.target.set(0, -this.layout.height * 0.1, 0);
    this.camera.zoom = this.options.inspect ? 1.10 : 0.88;
    this.controls.update();
    this.camera.updateProjectionMatrix();
    this.updateAnnotations(false);
    this.invalidate();
  }

  viewCutaway() {
    if(this.options.mode!=='observe')return;
    this.camera.position.set(-900,50,1050);
    this.controls.target.set(0,0,0);this.camera.zoom=1;
    this.camera.updateProjectionMatrix();this.controls.update();
    this.updateAnnotations(false);this.invalidate();
  }

  cancelInput(silence = false) {
    for (const [id, element] of this.pointers) {
      element.classList.remove('held');
      if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
    }
    this.pointers.clear();
    this.surface.dataset.activePointers = '0';
    for (const { bell } of this.effects.values()) {
      bell.pivot.rotation.z = 0;
      bell.material.emissive.setHex(0);
    }
    this.effects.clear();
    this.overlay?.querySelectorAll('.struck').forEach(e => e.classList.remove('struck'));
    this.overlay?.querySelectorAll('.impact-active').forEach(e => e.classList.remove('impact-active'));
    this.mallets.forEach(mallet => { mallet.visible=false; });
    if (silence&&!this.keepSoundOnResize) this.audio.suspend();
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.invalidate();
  }

  invalidate() {
    if (!this.raf && this.options.active && !document.hidden && !this.disposed && !this.lost) this.raf = requestAnimationFrame(time => this.render(time));
  }

  render(time) {
    this.raf = 0;
    if (this.disposed || !this.options.active || document.hidden || this.lost) return;
    if (this.effects.size && time - this.lastFrame < 1000 / 30) { this.invalidate(); return; }
    this.lastFrame = time;
    this.mallets.forEach(mallet => { mallet.visible=false; });
    for(const bell of this.bells){bell.pivot.rotation.z=0;bell.material.emissive.setHex(0);}
    let malletIndex=0;
    for (const [id, effect] of this.effects) {
      const age = time - effect.at;
      const { bell, zone, region } = effect;
      const element = this.targetElements.get(`${bell.data.id}:${region}`);
      if (age > 560) {
        element?.classList.remove('struck');
        bell.impacts[region].classList.remove('impact-active');
        this.effects.delete(id);
        continue;
      }
      const motion=strikeMotion(age,this.reducedMotion);
      bell.material.emissive.set(PALETTE.feedback).multiplyScalar(motion.energy * 0.09);
      bell.pivot.rotation.z = motion.swing;
      if (motion.visible && malletIndex<this.mallets.length) {
        const mallet=this.mallets[malletIndex++];
        const anchor = new THREE.Vector3(...ANCHORS[STRIKE_ANCHORS[region]].map(v=>v*bell.modelRatio));
        bell.mesh.localToWorld(anchor);
        const malletScale=Math.min(230,Math.max(95,bell.scale*.78));
        mallet.scale.setScalar(malletScale);
        const direction=region==='left'?-1:1;
        const approachYaw=BELL_YAW+(zone==='side'?direction*.62:0);
        mallet.rotation.set(BELL_TILT+motion.angle,approachYaw,zone==='side'?-direction*2.5:2.6);
        const tip=new THREE.Vector3(...MALLET_TIP).applyQuaternion(mallet.quaternion).multiplyScalar(malletScale);
        mallet.position.copy(anchor).sub(tip);
        const outward=new THREE.Vector3(0,0,1).applyEuler(new THREE.Euler(BELL_TILT,approachYaw,0));
        mallet.position.addScaledVector(outward,motion.offset);
        mallet.visible = true;
      }
    }
    this.renderer.render(this.scene, this.camera);
    this.frames++;
    this.canvas.dataset.frameCount = String(this.frames);
    this.canvas.dataset.drawCalls = String(this.renderer.info.render.calls);
    this.canvas.dataset.triangles = String(this.renderer.info.render.triangles);
    this.canvas.dataset.geometries = String(this.renderer.info.memory.geometries);
    this.canvas.dataset.camera = JSON.stringify({ position: this.camera.position.toArray(), zoom: this.camera.zoom });
    if (this.effects.size) this.invalidate();
  }

  snapshot() {
    return {
      ready: true, mode: this.options.mode, layout: this.layout && { ...this.layout },
      palette: PALETTE, anchors: ANCHORS, targets: this.targets, bodies: this.bodies,
      issues: this.issues || [], frameCount: this.frames, rafPending: !!this.raf,
      fallbackReasons:this.fallbackReasons||[],
      drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures,
      pixelRatio: this.renderer.getPixelRatio(), activePointers: this.pointers.size,
      activeVoices: this.audio.voices.length, audioState: this.audio.context?.state || 'not-started',
      audioNotesStarted: this.audio.count, events: [...this.history],
      camera: { position: this.camera.position.toArray(), zoom: this.camera.zoom },
      visiblePitches: this.bells.map(b => ({ ...b.data })),
      bellScales: this.bells.map(b=>({id:b.data.id,octave:b.data.octave,column:b.data.column,scale:b.scale,physicalSize:b.physicalSize,modelRatio:b.modelRatio})),
      activeMallets: this.mallets.filter(m=>m.visible).length,
      bellCount:this.bells.length,rackVisible:this.rack?.visible||false,observationReady:!!this.observation,
      modelRevision:6,bellOrientation:{yaw:BELL_YAW,tilt:BELL_TILT},strikeRegions:STRIKE_REGIONS,
      suspension:{pivot:SUSPENSION.pivot,clippedYong:false,individualLinks:this.options.mode==='play'?this.bells.length:0},
      mallets:this.mallets.filter(m=>m.visible).map(m=>({position:m.position.toArray(),scale:m.scale.x})),
    };
  }

  dispose() {
    this.disposed = true;
    this.cancelInput(true);
    this.observer.disconnect();
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.controls.dispose();
    this.canvas.removeEventListener('pointerdown',this.handleBodyTap);
    for(const type of ['pointerup','pointercancel','lostpointercapture'])this.canvas.removeEventListener(type,this.handleBodyRelease);
    if(this.ownsAudio)this.audio.dispose();
    this.bells.forEach(bell => bell.material.dispose());
    this.assets.dispose();
    this.observation?.dispose();this.environment.dispose();
    this.backdrop?.geometry.dispose();this.backdrop?.material.dispose();
    this.floor?.geometry.dispose();this.floor?.material.dispose();
    this.keyLight.shadow.map?.dispose();
    this.renderer.dispose();
    this.surface.remove();
  }
}
