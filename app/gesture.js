(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HeadpatGesture=factory().HeadpatGesture;})(globalThis,function(){
 class HeadpatGesture {
  constructor(){this.reset();}
  reset(){this.last=null;this.start=0;this.distance=0;this.direction=0;this.turns=0;this.started=false;this.finish=0;}
  feed(x,y,time,inside){
   if(!inside){return null;}
   if(!this.last||time-this.last.time>600){this.reset();this.last={x,y,time};this.start=time;return null;}
   const dx=x-this.last.x,dy=y-this.last.y;
   if(Math.abs(dx)>0.008){const direction=Math.sign(dx);if(this.direction&&direction!==this.direction)this.turns++;this.direction=direction;}
   this.distance+=Math.hypot(dx,dy);this.last={x,y,time};this.finish=time;
   if(!this.started&&this.turns>=1&&this.distance>=0.10&&time-this.start>=100){this.started=true;return 'start';}
   return null;
  }
  end(){
   const seconds=Math.max(0.1,(this.finish-this.start)/1000);
   const result=this.started&&this.turns>=2&&this.distance>=0.22 ? {kind:this.distance/seconds>1.65?'rough':'gentle',speed:this.distance/seconds} : null;
   this.reset();return result;
  }
 }
 return {HeadpatGesture};
});
