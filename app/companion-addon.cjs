const {BrowserWindow,screen}=require('electron');const path=require('node:path');const {CompanionSession}=require('./companion.cjs');const {ActivityMonitor}=require('./activity-monitor.cjs');
class CompanionAddon {
 constructor({saved,save,options,secure,anchor,topmost,allowed,onChange,onReact=()=>{}}){
  Object.assign(this,{options,secure,anchor,topmost});this.disposing=false;this.pending=null;
  this.session=new CompanionSession({prefs:saved.prefs,usage:saved.usage,persist:save,allowed,onChange:state=>{if(this.control&&!this.control.isDestroyed())this.control.webContents.send('companion-state',state);onChange(state);},onSpeak:value=>{onReact(value);this.showToast(value);}});
  this.monitor=new ActivityMonitor({detectUndo:()=>this.session.prefs.undoEnabled,onReport:value=>{try{this.session.report(value);}catch{this.stop('本地状态无法保存，陪伴已关闭。');}},onError:message=>this.stop(message)});
  this.timer=setInterval(()=>{try{this.session.tick();}catch{this.stop('本地状态无法保存，陪伴已关闭。');}},1000);
 }
 state(){return this.session.state();}
 open(){if(!this.control){this.control=new BrowserWindow(this.options({width:480,height:680,minWidth:420,minHeight:500,title:'Kairos · 陪伴控制',backgroundColor:'#f5f8fb',autoHideMenuBar:true,show:false}));this.secure(this.control);this.control.loadFile(path.join(__dirname,'companion.html'));this.control.once('ready-to-show',()=>this.control.show());this.control.on('close',event=>{if(!this.disposing){event.preventDefault();this.control.hide();}});}else{this.control.show();this.control.focus();}}
 start(){this.session.start();this.monitor.start();return this.state();}
 configure(value){const changed=this.session.prefs.undoEnabled!==Boolean(value.undoEnabled);const state=this.session.configure(value);if(changed&&this.session.enabled){this.monitor.stop();this.session.healthy=false;this.monitor.start();}return state;}
 stop(message){this.monitor.stop();clearTimeout(this.toastTimer);this.toast?.hide();this.session.stop(message);return this.state();}
 showToast(value){this.pending=value;if(!this.toast){this.toast=new BrowserWindow(this.options({width:340,height:150,frame:false,transparent:true,thickFrame:false,resizable:false,maximizable:false,skipTaskbar:true,show:false,title:'Kairos · 陪伴吐槽'}));this.secure(this.toast);this.toast.loadFile(path.join(__dirname,'companion-toast.html'));this.toast.webContents.once('did-finish-load',()=>{if(this.session.enabled&&this.pending)this.present();});}else if(!this.toast.webContents.isLoading())this.present();}
 present(){const anchor=this.anchor(),area=screen.getDisplayMatching(anchor).workArea;const x=Math.max(area.x,Math.min(anchor.x+(anchor.width-340)/2,area.x+area.width-340));const y=anchor.y+anchor.height+150<=area.y+area.height?anchor.y+anchor.height:Math.max(area.y,anchor.y-150);
  this.toast.setBounds({x:Math.round(x),y:Math.round(y),width:340,height:150});this.toast.setAlwaysOnTop(this.topmost(),this.topmost()?'screen-saver':'normal');this.toast.webContents.send('companion-line',this.pending);this.toast.showInactive();clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>this.toast?.hide(),18000);
 }
 hideToast(){this.toast?.hide();}
 dispose(){this.disposing=true;clearInterval(this.timer);this.monitor.stop();clearTimeout(this.toastTimer);this.control?.destroy();this.toast?.destroy();}
}
module.exports={CompanionAddon};
