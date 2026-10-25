// Last-resort local drawing: real strike entrances survive a failed download.
export function drawBellPlaceholder(ctx,{x,y,width:w,height:h}){
  ctx.save();ctx.translate(x,y);
  const bronze=ctx.createLinearGradient(0,0,w,h);bronze.addColorStop(0,'#84907b');bronze.addColorStop(.45,'#434f42');bronze.addColorStop(.72,'#79806a');bronze.addColorStop(1,'#323e34');
  ctx.fillStyle=bronze;ctx.strokeStyle='#b49c65';ctx.lineWidth=1;
  ctx.fillRect(w*.45,h*.025,w*.10,h*.26);
  ctx.beginPath();ctx.moveTo(w*.23,h*.26);ctx.quadraticCurveTo(w*.5,h*.22,w*.77,h*.26);ctx.lineTo(w*.96,h*.95);ctx.quadraticCurveTo(w*.5,h*.66,w*.04,h*.95);ctx.closePath();ctx.fill();ctx.stroke();
  for(let row=0;row<3;row++)for(const u of [.28,.38,.62,.72]){
    ctx.beginPath();ctx.ellipse(w*u,h*(.37+row*.13),Math.max(2,w*.037),Math.max(2,w*.035),0,0,Math.PI*2);ctx.fillStyle='#b19a60';ctx.fill();ctx.stroke();
  }
  ctx.strokeStyle='rgba(197,164,93,.5)';for(const v of [.28,.46,.59,.73]){ctx.beginPath();ctx.moveTo(w*.20,h*v);ctx.lineTo(w*.80,h*v);ctx.stroke();}
  ctx.restore();
}
