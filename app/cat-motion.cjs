const FRAME_FILES={front:'Kairos kitty1.png',back:'Kairos kitty9.png',leftSit:'Kairos kitty walk8.png',rightSit:'Kairos kitty walk7.png',leftStand:'Kairos kitty walk2.png',leftStep1:'Kairos kitty walk3.png',leftStep2:'Kairos kitty walk4.png',rightStep:'Kairos kitty walk5.png',rightStand:'Kairos kitty walk6.png'};
// Align the visible body centre and foot row without resampling the source PNGs.
const FRAME_OFFSETS={front:[-3,4],back:[-3,4],leftSit:[-6,1],rightSit:[-5,1],leftStand:[6,1],leftStep1:[6,0],leftStep2:[6,1],rightStep:[2,1],rightStand:[2,1]};
class CatMotion {
 constructor({random=Math.random,x=0,now=0}={}){this.random=random;this.x=x;this.mode='sit';this.frame='front';this.last=now;this.until=now+this.restTime();this.direction=1;this.walkStarted=now;}
 restTime(){return 18000+this.random()*27000;}
 sit(now){this.mode='sit';this.frame=['front','front','back','leftSit','rightSit'][Math.min(4,Math.floor(this.random()*5))];this.until=now+this.restTime();}
 update(now,min,max){
  max=Math.max(min,max);this.x=Math.max(min,Math.min(max,this.x));
  const dt=Math.max(0,Math.min(.15,(now-this.last)/1000));this.last=now;
  if(this.mode==='sit'&&now>=this.until){
   if(max-min<32){this.sit(now);return this.state();}
   this.mode='walk';this.direction=this.x-min<60?1:max-this.x<60?-1:this.random()<.5?-1:1;
   this.speed=28+this.random()*12;this.walkStarted=now;this.until=now+1600+this.random()*2200;
  }
  if(this.mode==='walk'){
   if(now>=this.until){this.sit(now);return this.state();}
   this.x=Math.max(min,Math.min(max,this.x+this.direction*this.speed*dt));
   if(this.x===min||this.x===max){this.sit(now);return this.state();}
   const frames=this.direction<0?['leftStand','leftStep1','leftStand','leftStep2']:['rightStand','rightStep','rightStand','rightStep'];
   this.frame=frames[Math.floor((now-this.walkStarted)/160)%frames.length];
  }
  return this.state();
 }
 state(){return {x:this.x,mode:this.mode,frame:this.frame,direction:this.direction};}
}
module.exports={CatMotion,FRAME_FILES,FRAME_OFFSETS};
