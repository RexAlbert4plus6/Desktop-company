const fs=require('node:fs');const assert=require('node:assert/strict');const {BrowserWindow,screen}=require('electron');
exports.run=async({app,pet,chat,subtitle,tarot,writeJSON,dataFile,getConfig})=>{
 const originalFetch=global.fetch;let calls=0,payload,mode='ok';const result={};
 try{
  await Promise.all([pet,chat,subtitle].map(w=>w.webContents.isLoading()?new Promise(r=>w.webContents.once('did-finish-load',r)):Promise.resolve()));
  const script=(w,js)=>w.webContents.executeJavaScript(js),wait=ms=>new Promise(r=>setTimeout(r,ms));await wait(250);
  await script(chat,`(async()=>{const s=await kairos.load();await kairos.save({...s.config,apiKey:'fake-tarot-smoke-key'});})()`);
  assert.match(await script(subtitle,`document.getElementById('input').placeholder`),/Samuel/);
  result.slot=await script(chat,`(async()=>{const s=await kairos.load();return s.slots.find(x=>x.name==='Samuel Valemont');})()`);assert.ok(result.slot.ready);
  assert.ok(await script(chat,`[...document.querySelectorAll('#character-slots button')].some(b=>b.textContent.includes('Samuel'))`));
  await script(pet,`kairos.headpat('start')`);await wait(100);assert.equal((await script(pet,`kairos.load()`)).expression.id,'smile2');await script(pet,`kairos.headpat('cancel')`);
  global.fetch=async(_url,options)=>{calls++;payload=JSON.parse(options.body);await wait(80);if(mode==='fail')return {ok:false,status:503};return {ok:true,json:async()=>({choices:[{message:{content:'Take your time, darling. You do not have to work everything out tonight. Let this card be an invitation to notice one small thing that gives you hope.'}}]})};};
  const windowCount=BrowserWindow.getAllWindows().length;await script(subtitle,`document.getElementById('accessory-toggle').click();document.getElementById('draw-card').click()`);await wait(200);
  assert.equal(BrowserWindow.getAllWindows().length,windowCount);assert.ok(subtitle.isVisible());assert.equal(calls,0);
  const dimensions=await script(subtitle,`({count:document.querySelectorAll('#tarot-cards img').length,loaded:[...document.querySelectorAll('#tarot-cards img')].every(i=>i.complete&&i.naturalWidth===70),width:document.querySelector('#tarot-cards button').getBoundingClientRect().width,stage:document.getElementById('tarot-desk').getBoundingClientRect().height,hidden:document.getElementById('tarot-desk').hidden,size:state.displaySize})`);
  assert.equal(dimensions.count,3);assert.ok(dimensions.loaded&&!dimensions.hidden);assert.ok(Math.abs(dimensions.width-dimensions.size/3)<1);result.dimensions=dimensions;
  fs.writeFileSync(dataFile('tarot-choice.png'),(await subtitle.webContents.capturePage()).toPNG());fs.writeFileSync(dataFile('samuel-preview.png'),(await pet.webContents.capturePage()).toPNG());
  const before=(await script(subtitle,`kairos.load()`)).history.length;
  await script(subtitle,`document.querySelector('#tarot-cards [data-card="1"]').click();document.querySelector('#tarot-cards [data-card="2"]').click()`);await wait(150);
  assert.equal(tarot.session.status,'spinning');assert.equal(calls,0);result.animation=await script(subtitle,`({name:getComputedStyle(document.querySelector('#tarot-cards .selected img')).animationName,duration:getComputedStyle(document.querySelector('#tarot-cards .selected img')).animationDuration})`);assert.equal(result.animation.name,'tarot-two-turns');
  await assert.rejects(()=>script(subtitle,`kairos.switchCharacter(0)`),/请求/);await wait(1150);assert.equal(calls,1);assert.equal(tarot.session.status,'done');
  const state=await script(subtitle,`kairos.load()`);assert.equal(state.history.length,before+2);assert.equal(state.history.at(-1).type,'tarot');assert.ok(state.history.at(-2).content.includes(tarot.state().card.name));assert.ok(await script(subtitle,`document.getElementById('bubbles').textContent.includes('Take your time, darling')`));assert.equal(payload.max_tokens,420);assert.ok(payload.messages[0].content.includes('Samuel'));result.inConversation=true;
  fs.writeFileSync(dataFile('tarot-result.png'),(await subtitle.webContents.capturePage()).toPNG());
  await tarot.read({id:tarot.session.id,index:2});assert.equal(calls,1);
  tarot.lastDeal=0;tarot.newDeal();mode='fail';await tarot.read({id:tarot.session.id,index:0});const selected=JSON.stringify(tarot.state().card);assert.equal(tarot.session.status,'error');mode='ok';await tarot.read({id:tarot.session.id,retry:true});assert.equal(JSON.stringify(tarot.state().card),selected);assert.equal(calls,3);
  tarot.lastDeal=0;tarot.newDeal();const cancelled=tarot.read({id:tarot.session.id,index:2});tarot.close();await cancelled;assert.equal(calls,3);assert.equal(tarot.session.status,'error');assert.ok(!tarot.shown);result.cancelBeforeApi=true;
  await tarot.open();await tarot.read({id:tarot.session.id,retry:true});assert.equal(calls,4);
  for(const size of [420,160]){await script(chat,`(async()=>{const s=await kairos.load();await kairos.save({...s.config,size:${size},apiKey:''});})()`);await wait(100);const b=subtitle.getBounds(),a=screen.getDisplayMatching(pet.getBounds()).workArea;result.lastLayout={b,a,pet:pet.getBounds(),requestedSize:size};assert.ok(b.y+b.height<=a.y+a.height+2);const sizes=await script(subtitle,`({width:document.querySelector('#tarot-cards button').getBoundingClientRect().width,size:state.displaySize})`);assert.ok(Math.abs(sizes.width-sizes.size/3)<1);}
  await script(subtitle,`kairos.switchCharacter(0)`);assert.equal(tarot.session,null);assert.ok(await script(subtitle,`document.getElementById('tarot-desk').hidden`));await script(subtitle,`kairos.switchCharacter(1)`);assert.match(await script(subtitle,`document.getElementById('input').placeholder`),/Samuel/);
  writeJSON(dataFile('smoke-result.json'),{passed:true,...result,calls,cap:420,retrySameCard:true,roleIsolation:true,noExtraWindow:true});
 }catch(e){writeJSON(dataFile('smoke-result.json'),{passed:false,...result,error:e.message,stack:e.stack});}finally{global.fetch=originalFetch;app.quit();}
};
