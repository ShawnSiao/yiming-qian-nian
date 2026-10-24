import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ARRIVAL,arrivalFrame,dustParticle} from '../app/home-arrival.mjs';
let checks=0;const check=(ok,message)=>{assert.ok(ok,message);checks++;};
check(arrivalFrame(0).offset>2&&arrivalFrame(0).phase==='descending','bell begins above the composition, not flashed in its final pose');
let previous=Infinity;
for(let t=0;t<ARRIVAL.drop;t+=50){const f=arrivalFrame(t);check(f.offset<=previous&&f.offset>=0&&f.active,'finite monotonic descent');previous=f.offset;}
check(arrivalFrame(ARRIVAL.drop).phase==='contact'&&arrivalFrame(ARRIVAL.drop).offset===0,'impact occurs exactly on the floor');
check(arrivalFrame(ARRIVAL.drop+ARRIVAL.settle).phase==='dust','dust remains after the tiny heavy settling motion');
check(arrivalFrame(ARRIVAL.drop+ARRIVAL.dust).phase==='settled'&&!arrivalFrame(1e9).active,'the presentation finishes and cannot keep an idle loop alive');
for(const t of [-10,0,100,2000,1e6]){const f=arrivalFrame(t,true);check(f.phase==='settled'&&f.offset===0&&f.dust===0&&!f.active,'reduced motion shows the full final object without falling or dust');}
for(const t of [ARRIVAL.drop+50,ARRIVAL.drop+150,ARRIVAL.drop+300])check(arrivalFrame(t).offset<.013,'the heavy bell does not bounce like rubber');
check(ARRIVAL.particles===32,'particle geometry has an explicit small budget');
for(let i=0;i<ARRIVAL.particles;i++){
  const a=dustParticle(i,.5);check(Object.values(a).every(Number.isFinite)&&a.y>=0&&Math.abs(a.x)<1&&a.size<.32,'puffs remain finite and close to contact');
  assert.deepEqual(a,dustParticle(i,.5));checks++;
}
const source=await readFile(new URL('../app/home-bell-scene.mjs',import.meta.url),'utf8'),landing=await readFile(new URL('../app/home-landing.mjs',import.meta.url),'utf8');
check(source.includes("if(this.purpose==='audition')")&&source.includes('new HomeLanding'),'dedicated structure inspection has no entrance motion or floor props');
check(source.includes('this.finishArrival();')&&source.includes('if(this.arriving||progress<1&&!this.reduced)this.invalidate()'),'input interrupts arrival and idle scheduling remains finite');
check(source.includes('time-this.lastArrivalRender<arrivalInterval')&&source.includes('ARRIVAL.drop?1000/45:1000/30'),'high-refresh displays cannot multiply entrance work; lingering dust drops to 30 fps');
check(source.includes('this.landing?.dispose()')&&landing.includes('object.geometry.dispose();object.material.dispose()'),'route exit releases particles, floor geometry and materials');
check(!landing.includes('setInterval'),'dust creates no permanent timer');
check(source.includes('this.audio?.landing(ARRIVAL.dust/1000)')&&source.includes('this.impactHandled=true'),'one contact frame, not repeated rendering, triggers the decaying landing sound');
check(landing.includes('new THREE.Points')&&!landing.includes('new THREE.TextureLoader'),'dust uses one bounded geometry, no network or raster dependency');
console.log(`${checks} finite arrival, dust, interruption and reduced-motion checks passed`);
