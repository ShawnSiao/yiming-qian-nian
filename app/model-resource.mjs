// No renderer imports here: the default experience must make zero 3D requests.
export class ModelResource {
  constructor({url=new URL('./models/single-bell.glb',import.meta.url).href,fetcher=(...args)=>fetch(...args)}={}){
    this.url=url;this.fetcher=fetcher;this.bytes=null;this.pending=null;this.generation=0;
  }
  load(){
    if(this.bytes)return Promise.resolve(this.bytes);
    if(this.pending)return this.pending;
    const generation=++this.generation,controller=new AbortController();this.controller=controller;
    const timer=setTimeout(()=>controller.abort(),30000);
    const request=this.fetcher(this.url,{signal:controller.signal}).then(async response=>{
      if(!response.ok)throw new Error(`Model HTTP ${response.status}`);
      const bytes=await response.arrayBuffer();
      if(controller.signal.aborted||generation!==this.generation)throw new DOMException('Cancelled','AbortError');
      if(bytes.byteLength<20||new DataView(bytes).getUint32(0,true)!==0x46546c67)throw new Error('Invalid GLB');
      this.bytes=bytes;return bytes;
    }).finally(()=>{clearTimeout(timer);if(this.pending===request){this.pending=null;this.controller=null;}});
    this.pending=request;return request;
  }
  cancel(){this.generation++;this.controller?.abort();this.pending=null;this.controller=null;}
}

// A view attempt owns its deadline and GPU scene, not the shared audio or bytes.
export function mountModel({host,resource,createScene,onState=()=>{},timeoutMs=30000,loadScene=()=>import('./home-bell-scene.mjs')}){
  let disposed=false,scene=null,timer;
  const close=()=>{clearTimeout(timer);scene?.dispose();scene=null;host.replaceChildren();};
  const fail=error=>{
    if(disposed)return;disposed=true;close();
    onState(error?.code==='WEBGL_UNAVAILABLE'?'unsupported':'error',null,error);
  };
  onState('loading');
  timer=setTimeout(()=>{resource.cancel();fail(new Error('Model preparation timed out'));},timeoutMs);
  Promise.all([loadScene(),resource.load()]).then(async([module,bytes])=>{
    if(disposed)return;
    scene=createScene(module.HomeBellScene,bytes,fail);
    await scene.ready;
    if(disposed)return;
    clearTimeout(timer);onState('ready',scene);
  }).catch(fail);
  return {dispose(){if(disposed)return;disposed=true;close();}};
}
