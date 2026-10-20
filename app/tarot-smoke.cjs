const fs=require('node:fs');const assert=require('node:assert/strict');
exports.run=async({app,pet,chat,subtitle,tarot,writeJSON,dataFile,getConfig})=>{
 const originalFetch=global.fetch;let calls=0;let payload;let mode='ok';
 try{
  await Promise.all([pet,chat,subtitle].map(w=>w.webContents.isLoading()?new Promise(r=>w.webContents.once('did-finish-load',r)):Promise.resolve()));
  const script=(w,js)=>w.webContents.executeJavaScript(js);const wait=ms=>new Promise(r=>setTimeout(r,ms));
  await script(chat,`(async()=>{const s=await kairos.load();await kairos.save({...s.config,apiKey:'fake-tarot-smoke-key'});})()`);
  assert.match(await script(subtitle,`document.getElementById('input').placeholder`),/Samuel/);
  assert.match(await script(chat,`document.getElementById('input').placeholder`),/Samuel/);
  await script(pet,`kairos.headpat('start')`);await wait(100);assert.equal((await script(pet,`kairos.load()`)).expression.id,'smile2');
  await script(pet,`kairos.headpat('end','gentle')`);await wait(100);const line=await script(subtitle,`document.getElementById('bubbles').textContent`);assert.ok(require('./interactions.cjs').headpatReaction);
  global.fetch=async(_url,options)=>{calls++;payload=JSON.parse(options.body);await wait(180);if(mode==='fail')return {ok:false,status:503};return {ok:true,json:async()=>({choices:[{message:{content:'The Star, upright. You can take your time, darling. Let one small, hopeful step be enough for today.'}}]})};};
  await script(subtitle,`kairos.tarotOpen()`);if(tarot.window.webContents.isLoading())await new Promise(r=>tarot.window.webContents.once('did-finish-load',r));await wait(200);
  assert.equal(calls,0);assert.equal(await script(tarot.window,`document.querySelectorAll('#cards img').length`),3);
  assert.ok(await script(tarot.window,`[...document.querySelectorAll('#cards img')].every(i=>i.complete&&i.naturalWidth===70)`));
  fs.writeFileSync(dataFile('tarot-choice.png'),(await tarot.window.webContents.capturePage()).toPNG());
  const promise=tarot.read({id:tarot.session.id,index:1,question:'Today?'});await assert.rejects(()=>tarot.read({id:tarot.session.id,index:2}),/正在/);
  await assert.rejects(()=>script(subtitle,`kairos.switchCharacter(0)`),/请求/);await promise;assert.equal(calls,1);assert.equal(payload.max_tokens,420);assert.ok(payload.messages[0].content.includes('Samuel'));assert.equal(payload.messages.length,2);assert.equal(getConfig().interactionProfile,'samuel');
  await wait(100);fs.writeFileSync(dataFile('tarot-result.png'),(await tarot.window.webContents.capturePage()).toPNG());
  await tarot.read({id:tarot.session.id,index:2});assert.equal(calls,1);
  tarot.lastDeal=0;tarot.newDeal();mode='fail';await tarot.read({id:tarot.session.id,index:0});const selected=JSON.stringify(tarot.state().card);assert.equal(tarot.state().status,'error');mode='ok';await tarot.read({id:tarot.session.id,retry:true});assert.equal(JSON.stringify(tarot.state().card),selected);assert.equal(calls,3);
  tarot.lastDeal=0;tarot.newDeal();const cancelled=tarot.read({id:tarot.session.id,index:2});tarot.controller.abort();await cancelled;assert.equal(tarot.state().status,'error');
  await script(subtitle,`kairos.switchCharacter(0)`);assert.equal(tarot.session,null);await wait(100);assert.ok(!/Samuel/.test(await script(subtitle,`document.getElementById('input').placeholder`)));
  await script(subtitle,`kairos.switchCharacter(1)`);await wait(100);assert.match(await script(subtitle,`document.getElementById('input').placeholder`),/Samuel/);
  writeJSON(dataFile('smoke-result.json'),{passed:true,calls,cap:payload.max_tokens,choiceImage:'tarot-choice.png',resultImage:'tarot-result.png',headpatLine:line,dynamicNames:true,retrySameCard:true,cancelled:true,roleIsolation:true});
 }catch(e){writeJSON(dataFile('smoke-result.json'),{passed:false,error:e.message,stack:e.stack});}finally{global.fetch=originalFetch;app.quit();}
};
