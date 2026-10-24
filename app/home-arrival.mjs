// A finite presentation timeline, not a physical or historical reconstruction.
export const ARRIVAL=Object.freeze({drop:2050,settle:320,dust:7200,height:2.85,particles:32});
const clamp=v=>Math.max(0,Math.min(1,v));
export function arrivalFrame(elapsed,reduced=false){
  if(reduced)return {phase:'settled',offset:0,dust:0,shadow:1,active:false};
  const t=Math.max(0,Number.isFinite(elapsed)?elapsed:0),p=clamp(t/ARRIVAL.drop),after=t-ARRIVAL.drop;
  if(after<0)return {phase:'descending',offset:ARRIVAL.height*(1-Math.pow(p,1.35)),dust:0,shadow:.15+.85*p*p,active:true};
  const q=clamp(after/ARRIVAL.settle),d=clamp(after/ARRIVAL.dust);
  return {phase:after<ARRIVAL.settle?'contact':after<ARRIVAL.dust?'dust':'settled',
    offset:.012*Math.sin(Math.PI*q)*(1-q),dust:d,shadow:1,
    active:after<ARRIVAL.dust};
}
export function dustParticle(index,progress){
  const seed=n=>{const x=Math.sin((index+1)*n)*43758.5453;return x-Math.floor(x);};
  const p=clamp(progress),angle=seed(12.9898)*Math.PI*2,radius=.10+seed(37.719)*.15;
  const spread=radius+(.25+seed(19.31)*.40)*Math.pow(p,.65);
  // Two mouth corners meet the floor first. Front-lit puffs spread from those
  // contacts rather than being hidden deep inside the open bell cavity.
  return {x:(index%2?1:-1)*.40+Math.cos(angle)*spread*.65,y:.01+(.14+seed(7.23)*.25)*Math.sin(Math.PI*p*.8),z:.36+Math.sin(angle)*spread*.40,size:.17+seed(11.41)*.14};
}
