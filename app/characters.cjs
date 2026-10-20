const fs=require('node:fs');
const path=require('node:path');
const {readJSON,writeJSON}=require('./core.cjs');
const FIELDS=['characterName','persona','memory','summaryCursor','manualExpression','accessories','greetingGroups','lastGreetingAt','lastConversationAt','interactionProfile'];
const ASSET_IDS=['normal','blink-half','blink-closed','happy','unhappy','angry','smile','smile2','surprised','confuse','mock','smirk','ears','scarf','sweater','tarot-back'];
function validSlot(value){return Number.isInteger(value)&&value>=0&&value<4;}
function syncSlot(config){
 const slot=config.characters[config.activeCharacter];
 for(const field of FIELDS)slot[field]=structuredClone(config[field]??(field==='accessories'?{}:''));
 return config;
}
function activate(config,index){
 if(!validSlot(index))throw new Error('请选择 1～4 号角色槽位。');
 config.activeCharacter=index;
 for(const field of FIELDS)config[field]=structuredClone(config.characters[index][field]);
 return config;
}
function migrateCharacters(config){
 if(!Array.isArray(config.characters)||config.characters.length!==4){
  config.characters=Array.from({length:4},(_,index)=>({characterName:index===0?'Kairos Asher':`角色 ${index+1}`,persona:index===0?config.persona:'请填写这个角色的身份、性格和说话方式。你与 Creator 是平等、熟悉的朋友。',memory:index===0?config.memory:'',summaryCursor:index===0?config.summaryCursor:0,manualExpression:index===0?config.manualExpression:'normal',accessories:{ears:false,scarf:false,sweater:false},greetingGroups:index===0?structuredClone(config.greetingGroups):{morning:[],midday:[],night:[],random:['我在，Creator。']},lastGreetingAt:0,lastConversationAt:0}));
  config.activeCharacter=0;
 }
 for(const [index,slot] of config.characters.entries())if(!['kairos','samuel','generic'].includes(slot.interactionProfile))slot.interactionProfile=/samuel/i.test(slot.characterName)?'samuel':index===0?'kairos':'generic';
 if(!validSlot(config.activeCharacter))config.activeCharacter=0;
 return activate(config,config.activeCharacter);
}
class CharacterFiles {
 constructor(dataDir,bundledRoot){this.root=path.join(dataDir,'character');this.bundledRoot=bundledRoot;fs.mkdirSync(this.root,{recursive:true});}
 folder(index){if(!validSlot(index))throw new Error('角色槽位无效。');return path.join(this.root,`slot-${index+1}`);}
 asset(index,id){
  if(!ASSET_IDS.includes(id))throw new Error('图片类型无效。');
  for(const file of [path.join(this.folder(index),'assets',id+'.png'),path.join(this.bundledRoot,`slot-${index+1}`,'assets',id+'.png')])if(fs.existsSync(file))return file;
  return '';
 }
 historyFile(index){return path.join(this.folder(index),'chat.json');}
 loadHistory(index,legacyFile){const file=this.historyFile(index);if(index===0&&!fs.existsSync(file)&&legacyFile&&fs.existsSync(legacyFile))writeJSON(file,readJSON(legacyFile,[]));return readJSON(file,[]);}
 saveHistory(index,history){writeJSON(this.historyFile(index),history);}
 installImage(index,id,source){if(!ASSET_IDS.includes(id))throw new Error('图片类型无效。');const folder=path.join(this.folder(index),'assets');fs.mkdirSync(folder,{recursive:true});fs.copyFileSync(source,path.join(folder,id+'.png'));}
 saveCard(index,slot){const folder=this.folder(index);fs.mkdirSync(folder,{recursive:true});writeJSON(path.join(folder,'character.json'),{version:1,name:slot.characterName,persona:slot.persona,interactionProfile:slot.interactionProfile});fs.writeFileSync(path.join(folder,'persona.txt'),slot.persona,'utf8');}
 exportCard(index,slot,destination){
  const folder=path.join(destination,`slot-${index+1}-${Date.now()}`);fs.mkdirSync(path.join(folder,'assets'),{recursive:true});
  writeJSON(path.join(folder,'character.json'),{version:1,name:slot.characterName,persona:slot.persona,interactionProfile:slot.interactionProfile});fs.writeFileSync(path.join(folder,'persona.txt'),slot.persona,'utf8');
  for(const id of ASSET_IDS){const source=this.asset(index,id);if(source)fs.copyFileSync(source,path.join(folder,'assets',id+'.png'));}
  return folder;
 }
}
module.exports={FIELDS,ASSET_IDS,validSlot,syncSlot,activate,migrateCharacters,CharacterFiles};
