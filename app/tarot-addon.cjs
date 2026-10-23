const {ipcMain}=require('electron');
const {setTimeout:delay}=require('node:timers/promises');
const {deal,messages,select,visible}=require('./tarot.cjs');
class TarotAddon{
 constructor(options){Object.assign(this,options);this.session=null;this.controller=null;this.lastDeal=0;this.shown=false;this.register();}
 state(){return {...(this.session?visible(this.session):{}),open:this.shown,back:this.back(),name:this.config().characterName,size:this.size(),spinMs:900};}
 publish(){const host=this.surface();if(host&&!host.isDestroyed())host.webContents.send('tarot-state',this.state());}
 assertRole(){if(this.config().interactionProfile!=='samuel')throw Error('Draw A Card 是 Samuel 的专属玩法。');}
 open(){this.assertRole();if(!this.session)this.newDeal();this.shown=true;this.onOpen();this.publish();return this.state();}
 newDeal(){this.assertRole();if(this.busy())throw Error('请等当前请求结束。');if(Date.now()-this.lastDeal<10000)throw Error('稍等片刻，再抽一轮吧。');this.session=deal();this.lastDeal=Date.now();this.onLayout();this.publish();return this.state();}
 async read(value){this.assertRole();const session=this.session;
  if(!session||value?.id!==session.id||!this.shown)throw Error('这轮牌已经收起，请重新打开。');
  if(session.status==='done')return this.state();
  if(this.busy())throw Error('正在解读，请稍等。');
  const key=this.key();if(!key)throw Error('先在设置中保存 API 密钥，再选择卡牌。');
  const first=session.selected===null;
  if(first)select(session,value.index,value.question);
  else if(!value.retry)throw Error('这轮已经选过牌，请使用重试。');
  const controller=new AbortController();this.controller=controller;this.setActive(controller);session.status=first?'spinning':'reading';session.error='';this.publish();
  try{
   // Wait for two visual turns before sending a single API request.
   if(first)await delay(1000,undefined,{signal:controller.signal});
   if(controller.signal.aborted)throw Object.assign(Error('cancelled'),{name:'AbortError'});
   session.status='reading';this.publish();const card=session.cards[session.selected];
   const answer=await this.complete({config:this.config(),key,messages:messages(this.config(),card,session.question),signal:controller.signal,maxTokens:420});
   if(controller.signal.aborted)throw Object.assign(Error('cancelled'),{name:'AbortError'});
   session.answer=answer.trim();this.onResult({answer:session.answer,card,question:session.question});session.status='done';
  }catch(error){session.status='error';session.error=error.name==='AbortError'?'已取消解读，可重试同一张牌。':this.error(error);}
  finally{this.controller=null;this.setActive(null);this.publish();}return this.state();
 }
 close(){this.controller?.abort();this.shown=false;this.onLayout();this.publish();}
 reset(){this.close();this.session=null;this.lastDeal=0;this.publish();}
 register(){
  const trusted=event=>{const host=this.surface();if(!host||event.sender!==host.webContents)throw Error('请从桌面角色下方操作塔罗牌。');};
  ipcMain.handle('tarot-open',event=>{trusted(event);return this.open();});
  ipcMain.handle('tarot-state',event=>{trusted(event);return this.state();});
  ipcMain.handle('tarot-new',event=>{trusted(event);return this.newDeal();});
  ipcMain.handle('tarot-read',(event,value)=>{trusted(event);return this.read(value);});
  ipcMain.handle('tarot-close',event=>{trusted(event);this.close();});
 }
}
module.exports={TarotAddon};
