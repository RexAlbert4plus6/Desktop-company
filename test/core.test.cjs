const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildMessages, complete, readJSON, writeJSON, endpoint, summarizeHistory } = require('../app/core.cjs');
const config = { provider: 'deepseek', base: 'https://api.deepseek.com', model: 'test-model', persona: '角色资料', memory: '喜欢薄荷', about: '称呼 Creator' };
test('context includes explicit memory and keeps complete recent turns within the limit', () => {
  const history = Array.from({ length: 100 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: String(i) }));
  const messages = buildMessages(config, history, '现在');
  assert.equal(messages.length, 42);
  assert.equal(messages[1].role, 'user');
  assert.match(messages[0].content, /喜欢薄荷/);
  assert.equal(messages.at(-1).content, '现在');
  assert.equal(history.length, 100);
});
test('worldbook is included while pure spoken dialogue overrides original action-writing style', () => {
  const messages = buildMessages({...config, persona:'Write *smirk* action beats', worldbook:'SIMS academy'}, [], 'hello');
  assert.match(messages[0].content, /SIMS academy/);
  assert.match(messages[0].content, /不写动作、表情/);
  assert.ok(messages[0].content.indexOf('桌面字幕输出规则') > messages[0].content.indexOf('Write *smirk*'));
});
test('memory summary covers history in batches and resumes without rereading covered history', async () => {
  const history = Array.from({length:8}, (_,i) => ({role:i%2?'assistant':'user',content:'内容'.repeat(3000)}));
  const progress=[];
  const fake = async (_url, options) => {
    const payload = JSON.parse(JSON.parse(options.body).messages[1].content);
    assert.ok(payload.existingMemory);
    return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({memory:'保留旧事实并合并新记忆'})}}]})};
  };
  const result=await summarizeHistory({config,history,key:'fake',fetchImpl:fake,onProgress:value=>progress.push(value)});
  assert.equal(result.summaryCursor,8); assert.equal(progress.length,3);
  assert.equal(progress.map(v=>v.processed).reduce((a,b)=>a+b),8);
  const resume=await summarizeHistory({config:{...config,summaryCursor:8},history,key:'fake',fetchImpl:()=>assert.fail('must not request'),onProgress:()=>assert.fail('must not overwrite')});
  assert.equal(resume.batches,0);
});
test('invalid summary does not overwrite memory or advance the saved cursor', async () => {
  await assert.rejects(summarizeHistory({config,history:[{role:'user',content:'hello'}],key:'fake',fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content:'not json'}}]})}),onProgress:()=>assert.fail('invalid result saved')}), /格式不正确/);
});
test('local records survive reading and rewriting; corrupted records are never silently erased', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kairos-test-'));
  const file = path.join(dir, 'chat.json');
  try {
    writeJSON(file, [{ content: '你好 Creator' }]);
    assert.deepEqual(readJSON(file, []), [{ content: '你好 Creator' }]);
    writeJSON(file, [{ content: '第二次' }]);
    assert.equal(readJSON(file, [])[0].content, '第二次');
    fs.writeFileSync(file, '{broken');
    assert.throws(() => readJSON(file, []), /无法读取/);
    assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('redirected Windows folders can save records when rename reports EXDEV', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kairos-redirected-'));
  const file=path.join(dir,'chat.json'),rename=fs.renameSync;
  try {
    fs.writeFileSync(file,JSON.stringify({text:'old'}));
    fs.renameSync=()=>{throw Object.assign(new Error('redirected folder'),{code:'EXDEV'});};
    writeJSON(file,{text:'新记录'});
    assert.deepEqual(readJSON(file,{}),{text:'新记录'});
    assert.equal(fs.existsSync(file+'.tmp'),false);
    fs.renameSync=()=>{throw Object.assign(new Error('permission denied'),{code:'EACCES'});};
    assert.throws(()=>writeJSON(file,{text:'must not overwrite'}),/permission denied/);
    assert.deepEqual(readJSON(file,{}),{text:'新记录'});
  } finally {fs.renameSync=rename;fs.rmSync(dir,{recursive:true,force:true});}
});
test('API request uses saved model, auth and messages; empty responses fail clearly', async () => {
  let request;
  const answer = await complete({ config, key: 'fake-test-key', messages: [{ role: 'user', content: 'hi' }], fetchImpl: async (url, opts) => { request = {url, opts}; return { ok: true, json: async () => ({ choices: [{ message: { content: 'hello' } }] }) }; } });
  assert.equal(answer, 'hello');
  assert.equal(request.url, 'https://api.deepseek.com/chat/completions');
  assert.equal(request.opts.headers.Authorization, 'Bearer fake-test-key');
  assert.equal(request.opts.redirect, 'error');
  assert.equal(JSON.parse(request.opts.body).model, 'test-model');
  await assert.rejects(complete({ config, key: 'fake', messages: [], fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [] }) }) }), /没有返回文字/);
});
test('failed credentials and missing keys return actionable messages without exposing secrets', async () => {
  await assert.rejects(complete({ config, key: '', messages: [] }), /填写 API 密钥/);
  await assert.rejects(complete({ config, key: 'secret', messages: [], fetchImpl: async () => ({ ok: false, status: 401 }) }), /密钥无效/);
  assert.throws(() => endpoint('http://example.com'), /HTTPS/);
  assert.throws(() => endpoint('https://example.com?key=secret'), /HTTPS/);
});
test('OpenRouter receives its own endpoint without DeepSeek-only parameters', async () => {
  await complete({ config: { ...config, provider: 'openrouter', base: 'https://openrouter.ai/api/v1' }, key: 'fake', messages: [], fetchImpl: async (url, opts) => {
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal('thinking' in JSON.parse(opts.body), false);
    return { ok: true, json: async () => ({choices: [{message: {content: 'OK'}}]}) };
  } });
});
