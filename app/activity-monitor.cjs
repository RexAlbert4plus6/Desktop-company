const fs=require('node:fs');const path=require('node:path');const {spawn}=require('node:child_process');
class ActivityMonitor {
 constructor({onReport,onError,detectUndo=()=>true}){Object.assign(this,{onReport,onError,detectUndo});this.child=null;}
 start(){if(this.child)return;const script=fs.readFileSync(path.join(__dirname,'activity-monitor.ps1'),'utf8').replace('KAIROS_PARENT_PID',String(process.pid)).replace('KAIROS_UNDO_ENABLED',this.detectUndo()?'$true':'$false');
  const exe=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  const child=spawn(exe,['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,stdio:['ignore','pipe','pipe']});this.child=child;let buffer='',received=false;
  const fail=()=>{if(this.child!==child)return;this.stop();this.onError('本地识别未能启动或已中断。陪伴已关闭，可重新开启。');};
  this.timeout=setTimeout(()=>{if(!received)fail();},20000);
  child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{if(this.child!==child)return;buffer+=chunk;if(buffer.length>32768){fail();return;}let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end).trim();buffer=buffer.slice(end+1);try{const value=JSON.parse(line);if(typeof value.app==='string'){received=true;clearTimeout(this.timeout);this.onReport(value);}}catch{}}});
  child.stderr.on('data',()=>{});child.on('error',fail);child.on('exit',fail);
 }
 stop(){const child=this.child;this.child=null;clearTimeout(this.timeout);if(child)child.kill();}
}
module.exports={ActivityMonitor};
