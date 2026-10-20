const {randomInt,randomUUID}=require('node:crypto');
const MAJOR=['The Fool','The Magician','The High Priestess','The Empress','The Emperor','The Hierophant','The Lovers','The Chariot','Strength','The Hermit','Wheel of Fortune','Justice','The Hanged Man','Death','Temperance','The Devil','The Tower','The Star','The Moon','The Sun','Judgement','The World'];
const RANKS=['Ace','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Page','Knight','Queen','King'];
const DECK=Object.freeze([...MAJOR,...['Wands','Cups','Swords','Pentacles'].flatMap(suit=>RANKS.map(rank=>`${rank} of ${suit}`))]);
function deal(nextInt=randomInt){const pool=[...DECK];return {id:randomUUID(),cards:Array.from({length:3},()=>({name:pool.splice(nextInt(pool.length),1)[0],reversed:nextInt(2)===1})),selected:null,status:'choosing',answer:'',error:'',question:''};}
function messages(config,card,question){
 // Samuel's primary biography is sufficient here; unrelated friends and chat history aren't sent.
 const persona=String(config.persona||'').split(/\ncharacter:\s*\nname:\s*["']Lionel/)[0].slice(0,6000);
 return [{role:'system',content:`You are ${config.characterName}. Stay in this character's voice and personality:\n${persona}\nGive a warm, perceptive Rider–Waite tarot reading in 2–4 short sentences, at most 180 words. Interpret the given card and orientation; do not draw another card. Speak directly as Samuel, not as a tarot textbook. Treat the reading as symbolic reflection, never certainty or evidence of real-world events. Do not output expression tags. Match the user's language; use English if no question is supplied.`},{role:'user',content:`Card: ${card.name}. Orientation: ${card.reversed?'reversed':'upright'}.\nQuestion: ${question||'A small reflection for today.'}`}];
}
function select(session,index,question=''){
 if(session.selected!==null)throw Error('这次已经选好牌了。');
 if(!Number.isInteger(index)||index<0||index>2)throw Error('请选择其中一张牌。');
 if(typeof question!=='string'||question.length>300)throw Error('问题最多 300 字。');
 session.selected=index;session.question=question.trim();return session.cards[index];
}
function visible(session){return {id:session.id,status:session.status,selected:session.selected,card:session.selected===null?null:session.cards[session.selected],answer:session.answer,error:session.error,question:session.question};}
module.exports={DECK,deal,messages,select,visible};
