const {test}=require('node:test');const assert=require('node:assert/strict');
const {CatMotion,FRAME_FILES,FRAME_OFFSETS}=require('../app/cat-motion.cjs');
test('cat rests most of its time, takes short walks and stays within the desktop',()=>{
 let seed=43;const random=()=>((seed=(seed*16807)%2147483647)/2147483647);
 const cat=new CatMotion({x:400,random});let sitting=0,walking=0;const frames=new Set();
 for(let now=0;now<600000;now+=66){const state=cat.update(now,-100,1000);assert.ok(state.x>=-100&&state.x<=1000);frames.add(state.frame);if(state.mode==='sit')sitting++;else walking++;}
 assert.ok(sitting/(walking+sitting)>.8);assert.ok(walking>0);assert.ok(frames.has('leftStep1'));assert.ok(frames.has('rightStep'));assert.ok(frames.has('back'));
});
test('cat clamps to changed displays, rests at edges, and does not teleport after sleep',()=>{
 const cat=new CatMotion({x:40,random:()=>.5});cat.until=0;cat.update(66,0,300);assert.equal(cat.direction,1);
 const before=cat.x;cat.update(100066,0,300);assert.ok(Math.abs(cat.x-before)<10);assert.equal(cat.mode,'sit');
 cat.update(100132,-300,-100);assert.ok(cat.x<=-100&&cat.x>=-300);
 cat.until=0;cat.update(100198,0,10);assert.equal(cat.mode,'sit');assert.ok(cat.x<=10);
 assert.deepEqual(Object.keys(FRAME_FILES).sort(),Object.keys(FRAME_OFFSETS).sort());
});
