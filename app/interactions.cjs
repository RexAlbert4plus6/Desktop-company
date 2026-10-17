const GENTLE = [
 ['mock','Hm...? This is sudden.'],['mock','You after something? I’m not promising I can deliver.'],
 ['confuse','That tickles...'],['smile','...Not bad.'],['smirk','Mess up my hair and I will be annoyed.'],
 ['smirk','...Keep going?'],['surprised','Hey—don’t.'],['mock','Bad mood?']
];
const ROUGH = [['surprised','Hey—my hair—'],['confuse','It’s a mess now... You gonna fix it.'],['smirk','Keep that up and I’m going to be annoyed.']];
const RARE = [['unhappy','Ugh...'],['angry','Put it back. Now.']];
const ACCESSORIES = [
 {id:'ears',label:'猫耳',lines:['Maybe I should let out a "meow"? Yeah, right.','Terrible taste—I’m serious.','Do you really think this is right for me?']},
 {id:'scarf',label:'围巾',lines:['Tristan claims he knitted it specifically for me... who knows, though.',"This color goes really well with my hair, doesn’t it?",'Thanks.']},
 {id:'sweater',label:'毛衣',lines:['It’s definitely a lot warmer.','This color is too soft—it just doesn’t suit me. I’m more of a cool type...','Don’t say things like "very cute."']}
];
function sample(items,random=Math.random) { return items[Math.min(items.length-1,Math.floor(random()*items.length))]; }
function headpatReaction(kind,random=Math.random) {
 const pool=kind==='rough' ? (random()<0.01 ? RARE : ROUGH) : GENTLE;
 const [expression,text]=sample(pool,random); return {expression,text};
}
function greetingAllowed(config,now=Date.now()) {
 const last=Math.max(config.lastGreetingAt||0,config.lastConversationAt||0);
 const minutes=Math.max(10,Math.min(20,Number(config.greetingCooldownMinutes)||15));
 return !last || now-last>=minutes*60000;
}
module.exports={GENTLE,ROUGH,RARE,ACCESSORIES,headpatReaction,greetingAllowed,sample};
