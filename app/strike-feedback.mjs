export const STRIKE_FEEDBACK_MS=820;
export function homeMalletFeedback(elapsed,viewportWidth){
  const height=viewportWidth<600?190:280,recoil=Math.max(0,Math.min(1,(elapsed-70)/410));
  return {height,width:height*143/640,recoil,alpha:1-recoil,offsetX:recoil*16,offsetY:recoil*18};
}
// The home image and the 3D feedback texture use the same artwork and anchor.
export function drawHomeMallet(ctx,image,height){
  const width=height*143/640;
  if(image){ctx.drawImage(image,-width/2,-height*.14,width,height);return;}
  ctx.save();ctx.translate(-width/2,-height*.14);
  const copper=ctx.createLinearGradient(0,0,width,0);
  copper.addColorStop(0,'#242e27');copper.addColorStop(.4,'#c5a45d');copper.addColorStop(1,'#66786d');
  ctx.fillStyle=copper;ctx.fillRect(width*.4,height*.24,width*.2,height*.76);
  ctx.beginPath();ctx.roundRect(0,0,width,height*.28,width*.1);ctx.fill();
  ctx.strokeStyle='#c5a45d';ctx.lineWidth=Math.max(1,height/320);
  for(const y of [.035,.25,.64,.69,.95]){ctx.beginPath();ctx.moveTo(width*(y<.3?.04:.4),height*y);ctx.lineTo(width*(y<.3?.96:.6),height*y);ctx.stroke();}
  ctx.restore();
}
export function malletFeedback(bell,elapsed,mobile=false){
  const height=Math.max(mobile?142:172,Math.min(mobile?190:245,bell.height*1.02));
  const recoil=Math.max(0,Math.min(1,(elapsed-70)/410));
  return {height,headWidth:height*143/640,alpha:Math.max(0,1-recoil),recoil,
    ringAlpha:Math.max(0,1-elapsed/STRIKE_FEEDBACK_MS)};
}
