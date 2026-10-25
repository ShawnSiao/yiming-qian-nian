import {t} from './i18n.mjs';
import {loadBellImage} from './image-resource.mjs';
import {drawBellPlaceholder} from './bell-placeholder.mjs';
import {HomeGesture,homeStrikeRegion} from './home-interaction.mjs';
import {ARRIVAL,arrivalFrame,dustParticle} from './home-arrival.mjs';
import {BELL_PARTS} from './data/bell-structure.mjs';
import {homeMalletFeedback,drawHomeMallet} from './strike-feedback.mjs';

// The always-available instrument. No renderer, GLB or three.js dependency.
export class Home2DScene {
  constructor(host,{audio,purpose='audition',intro=true,onStrike=()=>{},onInspect=()=>{},onProject=()=>{},onArrivalAudio=()=>{}}={}){
    Object.assign(this,{host,audio,purpose,onStrike,onInspect,onProject,onArrivalAudio});
    this.input=host.closest('.home-object');this.stage=host.closest('.home-screen');
    this.images={};this.effects=[];this.gesture=new HomeGesture();this.raf=0;this.frames=0;this.imageKey='poster';this.failed=new Set();
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.introPending=intro;this.arriving=false;this.visible=true;
    this.canvas=document.createElement('canvas');this.canvas.setAttribute('aria-hidden','true');host.append(this.canvas);this.ctx=this.canvas.getContext('2d');
    this.retry=document.createElement('button');this.retry.className='asset-retry';this.retry.type='button';this.retry.hidden=true;this.retry.textContent=t('重试图片');
    this.retry.onclick=event=>{event.stopPropagation();this.load(this.imageKey);this.load('mallet');};host.append(this.retry);
    this.input.tabIndex=0;this.input.setAttribute('role','group');this.refreshLanguage();
    const skip=event=>!this.visible||!!event.target.closest('button,input,a,select,.model-mode-controls');
    this.handlers={
      pointerdown:event=>{if(skip(event)||event.button!==0)return;this.finishArrival();this.gesture.start(event);try{this.input.setPointerCapture(event.pointerId);}catch{}},
      pointermove:event=>this.gesture.move(event),
      pointerup:event=>{const tap=this.gesture.end(event);if(this.input.hasPointerCapture?.(event.pointerId))this.input.releasePointerCapture(event.pointerId);if(tap&&this.visible)this.tap(tap.x,tap.y);},
      pointercancel:event=>this.gesture.end(event,true),lostpointercapture:event=>this.gesture.end(event,true),
      keydown:event=>{if(skip(event)||event.repeat)return;const region={'Enter':'center',' ':'center','ArrowLeft':'left','ArrowRight':'right'}[event.key];if(region){event.preventDefault();this.strike(region);}},
    };
    for(const [name,handler] of Object.entries(this.handlers))this.input.addEventListener(name,handler);
    this.onHidden=()=>{if(document.hidden){this.finishArrival();this.cancel();}else this.invalidate();};this.onBlur=()=>{this.finishArrival();this.cancel();this.invalidate();};
    document.addEventListener('visibilitychange',this.onHidden);window.addEventListener('blur',this.onBlur);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(this.input);this.resize();
    this.load('poster');if(purpose==='audition')this.load('mallet');this.ready=Promise.resolve(this);
  }
  load(key){
    if(this.disposed)return;this.retry.disabled=true;
    return loadBellImage(key).then(({image,url})=>{
      if(this.disposed)return;this.images[key]=image;this.failed.delete(key);this.host.dataset[key+'Source']=url.split('/').pop();
      if(key===this.imageKey){this.resize();this.beginArrival();}
    }).catch(()=>{if(!this.disposed){this.failed.add(key);if(key===this.imageKey)this.beginArrival();}}).finally(()=>{
      if(this.disposed)return;this.retry.disabled=false;this.retry.hidden=!this.failed.size;this.host.dataset.assetErrors=String(this.failed.size);this.invalidate();
    });
  }
  refreshLanguage(){
    if(!this.visible)return;
    this.input.setAttribute('aria-label',t(this.purpose==='inspect'?'编钟静态结构图，选择部位查看说明':'可敲击的编钟，中央正鼓与左右侧鼓'));
    if(this.retry)this.retry.textContent=t('重试图片');this.invalidate();
  }
  beginArrival(){
    if(this.introPending&&this.purpose==='audition'){
      this.introPending=false;this.arriving=!this.reduced;this.arrivalStart=null;this.impactHandled=this.reduced;
    }
  }
  setVisible(visible){this.visible=visible;this.host.style.opacity=visible?'1':'0';if(!visible){this.finishArrival();this.cancel();}else{this.refreshLanguage();this.resize();this.invalidate();}}
  setPart(id){
    this.part=id;const next=['cavity','section'].includes(id)?'section':'poster';
    if(next!==this.imageKey){this.imageKey=next;if(!this.images[next])this.load(next);this.resize();}this.invalidate();
  }
  resize(){
    if(this.disposed)return;const r=this.input.getBoundingClientRect(),stage=this.stage.getBoundingClientRect();
    this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);
    Object.assign(this.host.style,{left:`${r.left-stage.left}px`,top:`${r.top-stage.top}px`,width:`${r.width}px`,height:`${r.height}px`});
    const ratio=Math.min(devicePixelRatio||1,1.5);this.canvas.width=Math.round(this.width*ratio);this.canvas.height=Math.round(this.height*ratio);
    this.ctx.setTransform(ratio,0,0,ratio,0,0);
    const image=this.images[this.imageKey],aspect=image?image.naturalWidth/image.naturalHeight:768/1408;
    const h=Math.max(1,Math.min(this.height-18,(this.width-22)/aspect));
    this.box={x:(this.width-h*aspect)/2,y:(this.height-h)/2,width:h*aspect,height:h};
    this.host.dataset.contacts=JSON.stringify(['center','left','right'].map(region=>({region,midi:region==='center'?60:64,...this.point(region)})));
    this.invalidate();
  }
  point(region){const b=this.box;return {x:b.x+b.width*(region==='left'?.25:region==='right'?.75:.5),y:b.y+b.height*(region==='center'?.77:.82)};}
  strikeProjection(region){const p=this.point(region),r=this.canvas.getBoundingClientRect(),stage=this.stage.getBoundingClientRect();return {x:p.x+r.left-stage.left,y:p.y+r.top-stage.top};}
  tap(x,y){
    const r=this.canvas.getBoundingClientRect(),b=this.box,u=(x-r.left-b.x)/b.width,v=(y-r.top-b.y)/b.height;
    if(u<.06||u>.94||v<.04||v>.97||(v<.43&&Math.abs(u-.5)>.17))return;
    if(this.purpose==='inspect'){
      const id=this.imageKey==='section'?'cavity':v<.4?'yong':v<.49?'wu':v>.88?'mouth':v>.73?'gu':Math.abs(u-.5)<.13?'zheng':'mei';
      this.onInspect(id);return;
    }
    const region=homeStrikeRegion(u,v);if(region)this.strike(region);
  }
  strike(region){
    if(this.disposed||!this.visible||document.hidden)return;this.finishArrival();
    const midi=region==='center'?60:64;this.audio?.strike(midi).then(started=>{if(started&&!this.disposed)this.host.dataset.audioNotesStarted=String(this.audio.count);}).catch(()=>{});
    this.effects.push({region,at:performance.now()});this.effects=this.effects.slice(-3);
    Object.assign(this.host.dataset,{lastMidi:String(midi),lastRegion:region});this.onStrike({midi,region});this.invalidate();
  }
  finishArrival(){
    this.introPending=false;if(!this.arriving)return;this.arriving=false;this.impactHandled=true;this.host.dataset.arrival='settled';this.invalidate();
  }
  replayArrival(){
    if(this.disposed||this.purpose!=='audition')return;this.effects=[];this.audio?.stopLanding();this.impactHandled=false;this.arriving=!this.reduced;this.arrivalStart=null;
    if(this.reduced){this.impactHandled=true;this.onArrivalAudio(this.audio?.landing(ARRIVAL.dust/1000)?'playing':'blocked');}
    this.invalidate();
  }
  invalidate(){if(this.visible&&!this.disposed&&!document.hidden&&!this.raf)this.raf=requestAnimationFrame(time=>this.render(time));}
  render(time){
    this.raf=0;if(this.disposed||!this.visible||document.hidden)return;
    if(this.arriving&&this.lastFrame&&time-this.lastFrame<1000/30){this.invalidate();return;}this.lastFrame=time;
    const ctx=this.ctx,b=this.box;ctx.clearRect(0,0,this.width,this.height);
    let frame=arrivalFrame(0,true);
    if(this.arriving){
      if(this.arrivalStart===null)this.arrivalStart=time;frame=arrivalFrame(time-this.arrivalStart);this.arriving=frame.active;
      if(!this.impactHandled&&frame.phase!=='descending'){
        this.impactHandled=true;const played=this.audio?.landing(ARRIVAL.dust/1000)===true;this.host.dataset.landingSounds=String(this.audio?.landingCount||0);this.onArrivalAudio(played?'playing':'blocked');
      }
    }
    this.host.dataset.arrival=frame.phase;this.host.dataset.dust=String(frame.dust);
    const y=b.y-frame.offset*b.height/2,image=this.images[this.imageKey]||this.images.poster;
    if(image)ctx.drawImage(image,b.x,y,b.width,b.height);
    else if(this.failed.has(this.imageKey)||this.effects.length)drawBellPlaceholder(ctx,{...b,y});
    if(frame.phase==='dust'||frame.phase==='contact'){
      ctx.save();for(let i=0;i<18;i++){
        const p=dustParticle(i,frame.dust),x=b.x+b.width/2+p.x*b.width*.85,py=b.y+b.height-p.y*b.height*.18;
        ctx.globalAlpha=.19*Math.sin(Math.PI*Math.min(1,frame.dust*3))*Math.pow(1-frame.dust,1.5);
        const radius=(.5+frame.dust)*p.size*b.width*.12,gradient=ctx.createRadialGradient(x,py,0,x,py,Math.max(1,radius));
        gradient.addColorStop(0,'#c5b78d');gradient.addColorStop(1,'rgba(197,183,141,0)');ctx.fillStyle=gradient;ctx.fillRect(x-radius,py-radius,radius*2,radius*2);
      }ctx.restore();
    }
    this.effects=this.effects.filter(e=>time-e.at<820);
    for(const effect of this.effects){
      const p=this.point(effect.region),age=time-effect.at,fade=Math.max(0,1-age/820);ctx.save();ctx.globalAlpha=fade;ctx.strokeStyle='#c5a45d';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(p.x,p.y,10+(this.reduced?0:age*.035),0,Math.PI*2);ctx.stroke();
      if(!this.reduced){
        const feedback=homeMalletFeedback(age,this.width);
        ctx.globalAlpha=feedback.alpha;ctx.translate(p.x+(effect.region==='left'?-1:1)*feedback.offsetX,p.y+feedback.offsetY);
        drawHomeMallet(ctx,this.images.mallet,feedback.height);this.host.dataset.malletHeight=String(feedback.height);
      }ctx.restore();
    }
    if(this.purpose==='inspect'&&this.part&&this.part!=='overview'){
      const info=BELL_PARTS.find(p=>p.id===this.part);if(info){ctx.fillStyle='#eee2c7';ctx.font='13px sans-serif';ctx.textAlign='center';ctx.fillText(t(info.name),this.width/2,Math.max(18,this.height-4));}
    }
    this.frames++;this.host.dataset.frames=String(this.frames);this.host.dataset.malletCount=String(this.reduced?0:this.effects.filter(effect=>time-effect.at<480).length);this.host.dataset.renderer='home-canvas-2d';this.onProject(this);
    if(this.arriving||this.effects.length)this.invalidate();
  }
  cancel(){this.gesture.clear();this.effects=[];cancelAnimationFrame(this.raf);this.raf=0;}
  dispose(){this.disposed=true;this.cancel();this.observer.disconnect();for(const [name,handler] of Object.entries(this.handlers))this.input.removeEventListener(name,handler);document.removeEventListener('visibilitychange',this.onHidden);window.removeEventListener('blur',this.onBlur);this.host.replaceChildren();}
}
