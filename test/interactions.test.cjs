const {test}=require('node:test');const assert=require('node:assert/strict');
const {headpatReaction,GENTLE,ROUGH,RARE,greetingAllowed,ACCESSORIES}=require('../app/interactions.cjs');
const {HeadpatGesture}=require('../app/gesture.js');
test('gentle and rough headpats use supplied lines; rare pool needs <1% roll',()=>{
 assert.equal(headpatReaction('gentle',()=>0).text,GENTLE[0][1]);
 let rolls=[.009,0];assert.equal(headpatReaction('rough',()=>rolls.shift()).text,RARE[0][1]);
 rolls=[.01,0];assert.equal(headpatReaction('rough',()=>rolls.shift()).text,ROUGH[0][1]);
 assert.deepEqual(ACCESSORIES.map(item=>item.lines.length),[3,3,3]);
});
test('headpat gesture requires repeated sweeps, distinguishes speed, ignores simple hover',()=>{
 const gesture=new HeadpatGesture();gesture.feed(.3,.3,0,true);assert.equal(gesture.end(),null);
 for(const [i,x]of [.3,.5,.3,.5,.3].entries())gesture.feed(x,.3,i*220,true);
 assert.equal(gesture.end().kind,'gentle');
 for(const [i,x]of [.3,.5,.3,.5,.3].entries())gesture.feed(x,.3,i*60,true);
 assert.equal(gesture.end().kind,'rough');
 gesture.feed(.3,.3,0,true);gesture.feed(.5,.3,900,true);assert.equal(gesture.end(),null);
});
test('greeting cooldown uses most recent conversation/greeting and survives restart',()=>{
 const now=2e9,config={lastGreetingAt:now-14*60000,greetingCooldownMinutes:15};
 assert.equal(greetingAllowed(config,now),false);assert.equal(greetingAllowed(config,now+60000),true);
 assert.equal(greetingAllowed({...config,lastConversationAt:now},now+60000),false);
 assert.equal(greetingAllowed({greetingCooldownMinutes:15},now),true);
});
