export const STRIKE_FEEDBACK_MS=820;
export function malletFeedback(bell,elapsed,mobile=false){
  const height=Math.max(mobile?142:172,Math.min(mobile?190:245,bell.height*1.02));
  const recoil=Math.max(0,Math.min(1,(elapsed-70)/410));
  return {height,headWidth:height*143/640,alpha:Math.max(0,1-recoil),recoil,
    ringAlpha:Math.max(0,1-elapsed/STRIKE_FEEDBACK_MS)};
}
