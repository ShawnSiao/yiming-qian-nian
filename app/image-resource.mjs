const cache=new Map();
export const IMAGE_FILES=Object.freeze({
  top:'bell-small-v2',middle:'bell-medium-v2',bottom:'bell-large-v2',mallet:'bell-mallet-v10',
  poster:'home-bell-poster',section:'home-bell-section',
});
export function loadImage(url,{ImageClass=globalThis.Image,timeoutMs=8000,signal}={}){
  return new Promise((resolve,reject)=>{
    const image=new ImageClass();let settled=false;
    const finish=(error)=>{
      if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);
      image.onload=null;image.onerror=null;
      if(error){image.src='';reject(error);}else resolve(image);
    };
    const abort=()=>finish(new DOMException('Cancelled','AbortError'));
    const timer=setTimeout(()=>finish(new Error('Image timed out')),timeoutMs);
    signal?.addEventListener('abort',abort,{once:true});
    image.onload=()=>Promise.resolve().then(()=>image.decode?.()).then(()=>{
      if(image.naturalWidth>0&&image.naturalHeight>0)finish();else finish(new Error('Empty image'));
    }).catch(finish);
    image.onerror=()=>finish(new Error('Image unavailable'));
    image.decoding='async';if(signal?.aborted)abort();else image.src=url;
  });
}
export async function loadImageFallback(urls,options){
  let error;
  for(const url of urls){try{return {image:await loadImage(url,options),url};}catch(reason){error=reason;if(options?.signal?.aborted)throw reason;}}
  throw error||new Error('Image unavailable');
}
export function loadBellImage(key){
  if(!IMAGE_FILES[key])return Promise.reject(new Error('Unknown image'));
  if(!cache.has(key)){
    const urls=['webp','png'].map(extension=>new URL(`./assets/images/${IMAGE_FILES[key]}.${extension}`,import.meta.url).href);
    const pending=loadImageFallback(urls).catch(error=>{cache.delete(key);throw error;});cache.set(key,pending);
  }
  return cache.get(key);
}
