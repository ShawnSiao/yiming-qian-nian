import assert from 'node:assert/strict';
import {ModelResource,mountModel} from '../app/model-resource.mjs';
import {loadImageFallback} from '../app/image-resource.mjs';

const glb=new ArrayBuffer(24);new DataView(glb).setUint32(0,0x46546c67,true);
let fetches=0,complete;
const resource=new ModelResource({fetcher:(_url,{signal})=>{fetches++;return new Promise((resolve,reject)=>{complete=()=>resolve({ok:true,arrayBuffer:async()=>glb});signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')));});}});
assert.equal(fetches,0,'Constructing the default page resource cannot request a model');
const a=resource.load(),b=resource.load();assert.equal(a,b);assert.equal(fetches,1);complete();await a;assert.equal(await resource.load(),glb);assert.equal(fetches,1);
resource.bytes=null;const cancelled=resource.load();resource.cancel();await assert.rejects(cancelled,{name:'AbortError'});assert.equal(resource.bytes,null);
let lateResolve;const late=new ModelResource({fetcher:()=>new Promise(resolve=>{lateResolve=resolve;})});
const stale=late.load();late.cancel();lateResolve({ok:true,arrayBuffer:async()=>glb});await assert.rejects(stale,{name:'AbortError'});assert.equal(late.bytes,null);
const statuses=[];let disposed=0;const host={replaceChildren(){}};
const loadScene=async()=>({HomeBellScene:class{}});
const failed=mountModel({host,resource:{load:async()=>glb,cancel(){}},timeoutMs:20,loadScene,createScene:()=>({ready:new Promise(()=>{}),dispose(){disposed++;}}),onState:state=>statuses.push(state)});
await new Promise(resolve=>setTimeout(resolve,80));failed.dispose();assert.deepEqual(statuses,['loading','error']);assert.equal(disposed,1);
let resolveFrame;const transitions=[];disposed=0;
const attempt=mountModel({host,resource:{load:async()=>glb,cancel(){}},timeoutMs:1000,loadScene,createScene:()=>({ready:new Promise(resolve=>{resolveFrame=resolve;}),dispose(){disposed++;}}),onState:state=>transitions.push(state)});
await new Promise(resolve=>setTimeout(resolve,20));attempt.dispose();resolveFrame();await new Promise(resolve=>setTimeout(resolve,10));assert.deepEqual(transitions,['loading']);assert.equal(disposed,1);
class ImageStub{
  constructor(){this.naturalWidth=100;this.naturalHeight=200;}
  set src(value){this.value=value;if(value)queueMicrotask(()=>value.includes('missing')?this.onerror?.():this.onload?.());}
  decode(){return this.value.includes('.webp')?Promise.reject(new Error('Decode failed')):Promise.resolve();}
}
const image=await loadImageFallback(['bell.webp','bell.png'],{ImageClass:ImageStub,timeoutMs:50});assert.equal(image.url,'bell.png');
await assert.rejects(loadImageFallback(['missing.webp','missing.png'],{ImageClass:ImageStub,timeoutMs:50}));
class HangingImage extends ImageStub{set src(value){this.value=value;}}
await assert.rejects(loadImageFallback(['slow.webp'],{ImageClass:HangingImage,timeoutMs:5}),/timed out/);
console.log('Resources: zero eager fetch, shared bytes, abort/stale races, first-frame deadline, cancellation and PNG fallback passed.');
