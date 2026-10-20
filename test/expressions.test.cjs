const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseExpressionReply, ExpressionController, EXPRESSIONS } = require('../app/expressions.cjs');
const { PortraitAnimator } = require('../app/portrait.js');
function clock() {
  let now = 0, index = 0; const pending = new Map();
  return { now:()=>now, schedule:(callback,delay)=>{pending.set(++index,{at:now+delay,callback});return index;},cancel:id=>pending.delete(id),
    advance(duration) { const end=now+duration; for (;;) { const next=[...pending].sort((a,b)=>a[1].at-b[1].at).find(([,v])=>v.at<=end); if(!next)break;now=next[1].at;pending.delete(next[0]);next[1].callback(); } now=end; } };
}
test('reply metadata is stripped, unknown/missing codes safely use normal', () => {
  assert.deepEqual(parseExpressionReply('Creator, really?\n[[expression:smirk]]'),{answer:'Creator, really?',expression:'smirk'});
  assert.deepEqual(parseExpressionReply('你好\n[[expression:unknown]]'),{answer:'你好',expression:'normal'});
  assert.deepEqual(parseExpressionReply('普通回复'),{answer:'普通回复',expression:'normal'});
  assert.throws(()=>parseExpressionReply('[[expression:happy]]'),/没有台词/);
  assert.equal(parseExpressionReply('You typed [[expression:happy]], right?').expression,'normal');
  assert.equal(EXPRESSIONS.length,10);
});
test('automatic expressions expire after five seconds and new replies replace old timers', () => {
  const time=clock();const controller=new ExpressionController({...time});
  controller.automatic('happy');time.advance(4999);assert.equal(controller.state().id,'happy');
  controller.automatic('angry');time.advance(1);assert.equal(controller.state().id,'angry');
  time.advance(4999);assert.deepEqual(controller.state(),{id:'normal',locked:false,expiresAt:0});
});
test('manual expression survives time and responses until Normal unlocks automation', () => {
  const time=clock();const controller=new ExpressionController({...time});
  controller.automatic('happy');controller.selectManual('angry');time.advance(20000);
  controller.automatic('smirk');assert.deepEqual(controller.state(),{id:'angry',locked:true,expiresAt:0});
  controller.selectManual('normal');controller.automatic('confuse');assert.equal(controller.state().id,'confuse');
  time.advance(5000);assert.equal(controller.state().id,'normal');
});
test('normal blink uses open-half-closed-half-open and expressions cancel outstanding frames', () => {
  const time=clock(),frames=[];const images=Object.fromEntries(['normal','blink-half','blink-closed','angry','happy'].map(id=>[id,id+'.png']));
  const portrait=new PortraitAnimator({...time,images,draw:(_src,id)=>frames.push(id),random:()=>0.5});
  portrait.show('normal');time.advance(4500);assert.equal(frames.at(-1),'blink-half');
  time.advance(50);assert.equal(frames.at(-1),'blink-closed');time.advance(90);assert.equal(frames.at(-1),'blink-half');
  time.advance(50);assert.equal(frames.at(-1),'normal');
  time.advance(4500);portrait.show('angry');const count=frames.length;time.advance(20000);
  assert.equal(frames.length,count);assert.equal(frames.at(-1),'angry');
  portrait.show('normal');time.advance(4500);assert.equal(frames.at(-1),'blink-half');
  portrait.show('happy');time.advance(200);assert.equal(frames.at(-1),'happy');
});
test('hidden portrait does not blink; resume restarts the normal cycle', () => {
  const time=clock(),frames=[];const portrait=new PortraitAnimator({...time,images:{normal:'open', 'blink-half':'half','blink-closed':'closed'},draw:(_s,id)=>frames.push(id),random:()=>0.5});
  portrait.show('normal');portrait.pause();const count=frames.length;time.advance(10000);assert.equal(frames.length,count);
  portrait.resume();time.advance(4500);assert.equal(frames.at(-1),'blink-half');portrait.dispose();
});
test('headpat temporarily overrides a manual face and restores the exact lock afterward',()=>{
 const time=clock(),controller=new ExpressionController({...time,manual:'angry'});
 controller.temporary('smile',0);assert.equal(controller.state().id,'smile');assert.equal(controller.state().locked,true);
 controller.temporary('mock',5000);time.advance(5000);assert.deepEqual(controller.state(),{id:'angry',locked:true,expiresAt:0});
});
