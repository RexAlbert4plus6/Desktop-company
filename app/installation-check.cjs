const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');const assert=require('node:assert/strict');
exports.run=async({app,pet,chat,subtitle,writeJSON,dataFile})=>{try{
 await Promise.all([pet,chat,subtitle].map(w=>w.webContents.isLoading()?new Promise(r=>w.webContents.once('did-finish-load',r)):Promise.resolve()));
 const run=code=>chat.webContents.executeJavaScript(code),wait=ms=>new Promise(r=>setTimeout(r,ms));await wait(300);
 let state=await run('kairos.load()');const index=state.slots.find(s=>s.name==='Samuel Valemont')?.index;assert.ok(Number.isInteger(index));
 await run(`kairos.switchCharacter(${index===0?1:0})`);await wait(100);await run(`kairos.switchCharacter(${index})`);await wait(200);state=await run('kairos.load()');
 const form=await run(`({name:document.getElementById('characterName').value,persona:document.getElementById('persona').value,groups:Object.fromEntries(['morning','midday','night','random'].map(g=>[g,document.getElementById('greeting-'+g).value.split('\\n').filter(Boolean)]))})`);
 assert.equal(form.name,'Samuel Valemont');assert.equal(form.persona,state.config.persona);assert.ok(form.persona.length>9000);assert.deepEqual(Object.fromEntries(Object.entries(form.groups).map(([k,v])=>[k,v.length])),{morning:2,midday:2,night:2,random:9});
 await assert.rejects(()=>run(`(async()=>{const s=await kairos.load();await kairos.save({...s.config,characterId:${index===0?1:0},apiKey:''});})()`),/旧表单/);
 const art=state.expressionImages;const images=Object.entries(art).filter(([,url])=>url).length;assert.ok(images>=9);assert.ok(state.tarotAvailable);assert.ok(state.slots[index].ready);
 const result={passed:true,version:app.getVersion(),dataDirectory:app.getPath('userData'),activeSlot:index+1,name:form.name,personaLength:form.persona.length,personaHash:crypto.createHash('sha256').update(form.persona).digest('hex'),greetings:Object.fromEntries(Object.entries(form.groups).map(([k,v])=>[k,v.length])),expressionImages:images,tarotAvailable:true,staleFormBlocked:true};
 const file=dataFile('diagnostics/character-load-check.json');fs.mkdirSync(path.dirname(file),{recursive:true});writeJSON(file,result);
 }catch(e){writeJSON(dataFile('diagnostics/character-load-check.json'),{passed:false,error:e.message,stack:e.stack});}finally{app.quit();}};
