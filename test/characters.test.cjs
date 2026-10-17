const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {migrateCharacters,syncSlot,activate,CharacterFiles}=require('../app/characters.cjs');
test('four slots migrate legacy persona and isolate memory while keeping worldbook and user info',()=>{
 const config={persona:'original persona',memory:'original memory',summaryCursor:2,manualExpression:'normal',greetingGroups:{random:['hi']},worldbook:'shared world',about:'shared creator'};
 migrateCharacters(config);assert.equal(config.characters.length,4);assert.equal(config.persona,'original persona');
 syncSlot(config);activate(config,1);assert.equal(config.memory,'');assert.notEqual(config.persona,'original persona');
 config.persona='new persona';config.memory='second memory';syncSlot(config);activate(config,0);
 assert.equal(config.memory,'original memory');assert.equal(config.persona,'original persona');assert.equal(config.worldbook,'shared world');assert.equal(config.about,'shared creator');
 activate(config,1);assert.equal(config.memory,'second memory');assert.equal(config.persona,'new persona');
});
test('character storage keeps history separate and materializes a portable asset/persona package',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kairos-character-'));try{
  const files=new CharacterFiles(dir,path.join(dir,'bundled'));files.saveHistory(0,[{content:'first'}]);files.saveHistory(1,[{content:'second'}]);
  assert.equal(files.loadHistory(0)[0].content,'first');assert.equal(files.loadHistory(1)[0].content,'second');
  const source=path.join(dir,'source.png');fs.writeFileSync(source,'test-binary');files.installImage(1,'normal',source);
  const folder=files.exportCard(1,{characterName:'Sample',persona:'sample persona',memory:'private memory'},path.join(dir,'exports'));
  assert.ok(fs.existsSync(path.join(folder,'assets','normal.png')));const card=JSON.parse(fs.readFileSync(path.join(folder,'character.json'),'utf8'));
  assert.equal(card.name,'Sample');assert.equal(card.persona,'sample persona');assert.equal('memory'in card,false);
  assert.throws(()=>files.asset(1,'../secret'),/类型无效/);assert.throws(()=>files.folder(8),/槽位无效/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
