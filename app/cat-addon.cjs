const {BrowserWindow,screen}=require('electron');
const fs=require('node:fs');const path=require('node:path');const {pathToFileURL}=require('node:url');
const {CatMotion,FRAME_FILES,FRAME_OFFSETS}=require('./cat-motion.cjs');
class CatAddon {
 constructor({folder,options,secure,onReturn,topmost}){Object.assign(this,{folder,options,secure,onReturn,topmost});this.active=false;this.window=null;this.timer=null;this.frames=Object.fromEntries(Object.entries(FRAME_FILES).map(([id,name])=>[id,{url:pathToFileURL(path.join(folder,name)).href,offset:FRAME_OFFSETS[id]}]));this.available=Object.values(FRAME_FILES).every(name=>fs.existsSync(path.join(folder,name)));this.metrics=()=>this.reflow();screen.on('display-metrics-changed',this.metrics);screen.on('display-removed',this.metrics);}
 artwork(){return {frames:this.frames,scale:2};}
 enter(bounds){
  if(!this.available)throw Error('猫猫素材包尚未安装。');
  if(this.active){this.window.showInactive();return;}
  this.display=screen.getDisplayMatching(bounds);const now=Date.now();this.motion=new CatMotion({x:bounds.x,now});this.active=true;
  if(!this.window){
   this.window=new BrowserWindow(this.options({width:164,height:154,frame:false,transparent:true,thickFrame:false,resizable:false,maximizable:false,skipTaskbar:true,show:false,title:'Kairos · 猫猫试用'}));
   this.secure(this.window);this.window.webContents.setZoomFactor(1);
   this.window.once('ready-to-show',()=>{if(this.active)this.window.showInactive();});
   this.window.on('close',event=>{if(!this.disposing){event.preventDefault();this.onReturn();}});
   this.window.loadFile(path.join(__dirname,'cat.html'));
  }else this.window.showInactive();
  this.tick();this.timer=setInterval(()=>this.tick(),66);
 }
 tick(){if(!this.active||!this.window)return;const area=this.display.workArea,ratio=this.display.scaleFactor;
  const width=Math.ceil(164/ratio),height=Math.ceil(154/ratio);
  const state=this.motion.update(Date.now(),area.x,area.x+area.width-width);
  this.window.setBounds({x:Math.round(state.x),y:area.y+area.height-height,width,height});
  this.window.setAlwaysOnTop(this.topmost(),this.topmost()?'screen-saver':'normal');
  if(this.frame!==state.frame){this.frame=state.frame;this.window.webContents.send('cat-frame',state.frame);}
 }
 reflow(){if(!this.active)return;this.display=screen.getAllDisplays().find(item=>item.id===this.display.id)||screen.getPrimaryDisplay();this.tick();}
 leave(){this.active=false;clearInterval(this.timer);this.timer=null;this.window?.hide();}
 dispose(){this.leave();this.disposing=true;this.window?.destroy();screen.removeListener('display-metrics-changed',this.metrics);screen.removeListener('display-removed',this.metrics);}
}
module.exports={CatAddon};
