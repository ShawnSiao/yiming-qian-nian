import { PerformanceScene } from './performance.mjs';
import { BellAudio } from './audio.mjs';

// Performance has no static Three/GLTF import and never loads a bell model.
// The original detailed single-bell viewer is lazy and independent.
export class InstrumentScene {
  constructor(host,callbacks={}){
    this.callbacks=callbacks;this.audio=new BellAudio();this.disposed=false;
    this.options={mode:callbacks.initialMode||'play',active:true};
    this.playHost=document.createElement('div');this.observeHost=document.createElement('div');
    this.playHost.className=this.observeHost.className='instrument-engine';host.append(this.playHost,this.observeHost);
    this.play=new PerformanceScene(this.playHost,{...callbacks,audio:this.audio,onMeasure:s=>{if(this.options.mode==='play')callbacks.onMeasure?.(s);}});
    this.ready=this.play.ready;this.setOptions(this.options);
  }
  get current(){return this.options.mode==='observe'?this.observation:this.play;}
  get layout(){return this.current?.layout||this.play.layout;}
  setOptions(next){
    const previous=this.options;this.options={...previous,...next};
    const observe=this.options.mode==='observe';
    this.playHost.hidden=observe;this.observeHost.hidden=!observe;
    this.play.setOptions({...this.options,active:this.options.active&&!observe});
    if(previous.mode!==this.options.mode)this.audio.stop();
    if(observe)this.ensureObservation();
    this.observation?.setOptions({...this.options,mode:'observe',active:this.options.active&&observe});
    if(!observe){this.play.resize();this.callbacks.onMeasure?.(this.play.snapshot());}
  }
  async ensureObservation(){
    if(this.observation||this.loading||this.disposed)return;
    this.loading=true;const status=document.createElement('div');status.className='observation-loading';status.setAttribute('role','status');status.textContent='正在载入单钟模型…';this.observeHost.append(status);
    try{
      const [{BellScene},{loadBellGeometry}]=await Promise.all([import('./scene.mjs'),import('./geometry.mjs')]);
      const geometry=await loadBellGeometry();
      if(this.disposed){geometry.dispose();return;}
      this.observation=new BellScene(this.observeHost,{...this.callbacks,geometry,audio:this.audio,initialMode:'observe',onMeasure:s=>{if(this.options.mode==='observe')this.callbacks.onMeasure?.(s);}});
      this.observation.setOptions({...this.options,mode:'observe',active:this.options.active&&this.options.mode==='observe'});
    }catch(error){if(!this.disposed)this.callbacks.onMessage?.(`单钟模型暂未载入：${error.message}`);}
    finally{status.remove();this.loading=false;}
  }
  strikeMidi(...args){return this.current?.strikeMidi(...args);}
  setTarget(value){this.current?.setTarget(value);}
  setCue(value){this.current?.setCue(value);}
  cancelInput(silence){this.play.cancelInput(silence);this.observation?.cancelInput(silence);}
  viewFront(){this.observation?.viewFront();}
  viewSide(){this.observation?.viewSide();}
  viewInterior(){this.observation?.viewInterior();}
  resetCamera(){this.observation?.resetCamera();}
  zoomBy(value){this.observation?.zoomBy(value);}
  snapshot(){return {...this.current?.snapshot(),observationLoaded:!!this.observation};}
  dispose(){this.disposed=true;this.play.dispose();this.observation?.dispose();this.audio.dispose();this.playHost.remove();this.observeHost.remove();}
}
