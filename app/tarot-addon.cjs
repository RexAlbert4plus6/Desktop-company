const {BrowserWindow,ipcMain}=require('electron');
const path=require('node:path');
const {deal,messages,select,visible}=require('./tarot.cjs');
class TarotAddon{
 constructor(options){Object.assign(this,options);this.session=null;this.window=null;this.controller=null;this.lastDeal=0;this.register();}
 state(){return {...(this.session?visible(this.session):{}),back:this.back(),name:this.config().characterName};}
 publish(){if(this.window&&!this.window.isDestroyed())this.window.webContents.send('tarot-state',this.state());}
 assertRole(){if(this.config().interactionProfile!=='samuel')throw Error('Draw A Card 是 Samuel 的专属玩法。');}
 open(){this.assertRole();if(!this.session)this.newDeal();if(!this.window||this.window.isDestroyed()){
   this.window=new BrowserWindow(this.options({width:520,height:650,minWidth:460,minHeight:560,title:'Samuel · Draw A Card',backgroundColor:'#f3f3f8',autoHideMenuBar:true,show:false}));this.secure(this.window);
   this.window.loadFile(path.join(__dirname,'tarot.html'));this.window.once('ready-to-show',()=>this.window.show());
   this.window.on('close',()=>this.controller?.abort());this.window.on('closed',()=>{this.window=null;});
  }else{this.window.show();this.window.focus();}return this.state();}
 newDeal(){this.assertRole();if(this.busy())throw Error('请等当前请求结束。');if(Date.now()-this.lastDeal<10000)throw Error('稍等片刻，再抽一轮吧。');this.session=deal();this.lastDeal=Date.now();this.publish();return this.state();}
 async read(value){this.assertRole();const session=this.session;
  if(!session||value?.id!==session.id)throw Error('这轮牌已经结束，请重新打开。');
  if(session.status==='done')return this.state();
  if(this.busy())throw Error('正在解读，请稍等。');
  const key=this.key();if(!key)throw Error('先在设置中保存 API 密钥，再选择卡牌。');
  if(session.selected===null)select(session,value.index,value.question);
  else if(!value.retry)throw Error('这轮已经选过牌，请使用重试。');
  const controller=new AbortController();this.controller=controller;this.setActive(controller);session.status='reading';session.error='';this.publish();
  try{const answer=await this.complete({config:this.config(),key,messages:messages(this.config(),session.cards[session.selected],session.question),signal:controller.signal,maxTokens:420});
   if(controller.signal.aborted)throw Object.assign(Error('已取消解读，可重试同一张牌。'),{name:'AbortError'});
   session.answer=answer.trim();session.status='done';
  }catch(error){session.status='error';session.error=error.name==='AbortError'?'已取消解读，可重试同一张牌。':this.error(error);}
  finally{this.controller=null;this.setActive(null);this.publish();}return this.state();
 }
 reset(){this.controller?.abort();this.window?.close();this.session=null;this.lastDeal=0;}
 register(){
  ipcMain.handle('tarot-open',()=>this.open());
  const trusted=event=>{if(!this.window||event.sender!==this.window.webContents)throw Error('请从抽牌窗口操作。');};
  ipcMain.handle('tarot-state',event=>{trusted(event);return this.state();});
  ipcMain.handle('tarot-new',event=>{trusted(event);return this.newDeal();});
  ipcMain.handle('tarot-read',(event,value)=>{trusted(event);return this.read(value);});
  ipcMain.handle('tarot-close',event=>{trusted(event);this.window.close();});
 }
}
module.exports={TarotAddon};
