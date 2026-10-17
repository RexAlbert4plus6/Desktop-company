const $ = id => document.getElementById(id);
let state, busy = false, toastTimer;
function errorText(error) { return error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''); }
function toast(text) { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 6500); }
function showSettings(show) { $('settings').hidden = !show; $('conversation').hidden = show; $('settings-toggle').textContent = show ? '聊天' : '设置'; }
function renderHistory() {
  const area = $('messages'); area.replaceChildren();
  if (!state.history.length) {
    const welcome = document.createElement('div'); welcome.className = 'welcome';
    const title = document.createElement('strong'); title.textContent = (state.config.characterName||'角色')+' 在这里。';
    const desc = document.createElement('div'); desc.textContent = state.hasKey ? '说点什么吧，Creator。' : '先在设置里填好密钥，再开始你们的对话。';
    welcome.append(title, desc); area.append(welcome);
  }
  const visible = state.history.slice(-150);
  if (state.history.length > visible.length) { const note = document.createElement('p'); note.className = 'hint'; note.textContent = '显示最近 150 条；完整记录可从设置中导出。'; area.append(note); }
  for (const message of visible) {
    const row = document.createElement('article'); row.className = `message ${message.role}`;
    const name = document.createElement('small'); name.textContent = message.role === 'user' ? 'Creator' : state.config.characterName;
    const bubble = document.createElement('div'); bubble.className = 'bubble'; bubble.textContent = message.content;
    row.append(name, bubble); area.append(row);
  }
  area.scrollTop = area.scrollHeight;
}
function fill() {
  document.querySelector('.identity strong').textContent=state.config.characterName||'角色';
  for (const field of ['provider','base','model','about','memory','persona','worldbook','size','characterName','greetingCooldownMinutes']) $(field).value = state.config[field];
  renderCharacters();
  for (const group of ['morning','midday','night','random']) $(`greeting-${group}`).value = state.config.greetingGroups[group].join('\n');
  $('alwaysOnTop').checked = state.config.alwaysOnTop;
  $('apiKey').value = '';
  $('key-note').textContent = state.hasKey ? '这个服务商已有密钥。留空保留；填写新密钥则替换。' : '这个服务商还没有保存密钥。';
}
async function save() {
  const value = {};
  for (const field of ['provider','model','about','memory','persona','worldbook','size','apiKey','characterName','greetingCooldownMinutes']) value[field] = $(field).value;
  value.greetingGroups = Object.fromEntries(['morning','midday','night','random'].map(group => [group, $(`greeting-${group}`).value.split('\n').map(text=>text.trim()).filter(Boolean)]));
  value.alwaysOnTop = $('alwaysOnTop').checked;
  state = { ...state, ...await window.kairos.save(value) }; fill(); renderHistory();
}
function setBusy(value) { busy = value; $('send').disabled = value; $('cancel').hidden = !value; }
$('settings-toggle').onclick = () => showSettings($('settings').hidden);
$('back').onclick = () => showSettings(false);
$('settings-form').onsubmit = async event => { event.preventDefault(); try { await save(); toast('已保存。'); } catch (e) { toast(errorText(e)); } };
$('provider').onchange = () => {
  const provider = $('provider').value;
  $('base').value = state.providers[provider].base;
  $('model').value = provider === state.config.provider ? state.config.model : state.config.profiles[provider]?.model || state.providers[provider].model;
  $('apiKey').value = '';
  $('key-note').textContent = '切换后请填写模型名称；已保存的该平台密钥会保留。';
};
$('test').onclick = async () => {
  $('test').disabled = true;
  try { await save(); toast('正在连接…'); toast(await window.kairos.test()); }
  catch (e) { toast(errorText(e)); } finally { $('test').disabled = false; }
};
$('composer').onsubmit = async event => {
  event.preventDefault(); const text = $('input').value.trim(); if (busy || !text) return;
  if (!state.hasKey) { showSettings(true); toast('先填写密钥，再点“保存并测试连接”。'); return; }
  setBusy(true); $('status').textContent = 'Kairos 正在回复…';
  const preview = document.createElement('article'); preview.className = 'message user';
  const bubble = document.createElement('div'); bubble.className = 'bubble'; bubble.textContent = text;
  preview.append(bubble); $('messages').append(preview); $('messages').scrollTop = $('messages').scrollHeight;
  try { const result = await window.kairos.send(text); state.history = result.history; $('input').value = ''; $('status').textContent = ''; }
  catch (e) { $('status').textContent = errorText(e); }
  finally { setBusy(false); renderHistory(); $('input').focus(); }
};
$('input').onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); $('composer').requestSubmit(); } };
$('cancel').onclick = () => window.kairos.cancel();
for (const [id, action] of [['export','exportChat'],['data-folder','dataFolder']]) $(id).onclick = async () => { try { const message = await window.kairos[action](); if (message) toast(message); } catch (e) { toast(errorText(e)); } };
$('clear').onclick = async () => { try { state = { ...state, ...await window.kairos.clear() }; renderHistory(); } catch (e) { toast(errorText(e)); } };
window.kairos.onSettings(() => showSettings(true));
window.kairos.onState(value => {
  if (!state) return;
  const oldMemory = state.config.memory;
  const oldLength = state.history.length;
  state = { ...state, ...value };
  if (value.config.memory !== oldMemory && $('memory').value === oldMemory) $('memory').value = value.config.memory;
  if (value.history.length !== oldLength) renderHistory();
  setBusy(value.busy); $('summarize').disabled = value.busy;
});
window.kairos.onArtwork(value=>{state={...state,...value};fill();renderHistory();});
const imageFields=[['normal','Normal'],['blink-closed','Blink · 闭眼'],['blink-half','半闭眼（可选）'],['happy','开心'],['unhappy','不悦'],['angry','生气'],['smile','微笑'],['surprised','惊喜'],['confuse','疑惑（可选）'],['mock','嗤笑（可选）'],['smirk','坏笑（可选）']];
function renderCharacters(){
 const list=$('character-slots');list.replaceChildren();
 for(const slot of state.slots){const button=document.createElement('button');button.type='button';button.className='slot-card'+(slot.index===state.characterId?' selected':'');
  if(slot.image){const image=document.createElement('img');image.src=slot.image;image.alt='';button.append(image);}
  const label=document.createElement('span');label.textContent=`${slot.index+1} · ${slot.name}`;button.append(label);button.onclick=async()=>{try{await save();const value=await window.kairos.switchCharacter(slot.index);state={...state,...value};fill();renderHistory();toast('已切换角色，世界书和用户信息保持不变。');}catch(e){toast(errorText(e));}};list.append(button);}
 const images=$('character-images');images.replaceChildren();
 for(const [id,label]of imageFields){const button=document.createElement('button');button.type='button';button.className='image-drop';button.dataset.asset=id;button.setAttribute('aria-label',`导入 ${label}`);
  if(state.expressionImages?.[id]){const image=document.createElement('img');image.src=state.expressionImages[id];image.alt='';button.append(image);}
  const text=document.createElement('span');text.textContent=label;button.append(text);
  const importImage=async file=>{try{await save();const value=await window.kairos.importImage(state.characterId,id,file);if(value){state={...state,...value};fill();toast('图片已保存。');}}catch(e){toast(errorText(e));}};
  button.onclick=()=>importImage();button.ondragover=event=>{event.preventDefault();button.classList.add('drag-over');};button.ondragleave=()=>button.classList.remove('drag-over');button.ondrop=event=>{event.preventDefault();button.classList.remove('drag-over');const file=event.dataTransfer.files[0];if(file)importImage(file);};images.append(button);}
}
$('character-folder').onclick=async()=>{try{const result=await window.kairos.characterFolder();if(result)toast(result);}catch(e){toast(errorText(e));}};
$('import-character').onclick=async()=>{try{await save();const value=await window.kairos.importCharacter();if(value){state={...state,...value};fill();renderHistory();toast('已导入角色素材包。');}}catch(e){toast(errorText(e));}};
$('export-character').onclick=async()=>{try{await save();toast(await window.kairos.exportCharacter());}catch(e){toast(errorText(e));}};
$('summarize').onclick = async () => {
  $('summarize').disabled = true;
  try { await save(); toast('正在回顾并总结新对话，完成后自动保存…'); const result = await window.kairos.summarize(); state = { ...state, ...result }; fill(); toast(result.summaryMessage); }
  catch(error) { toast(errorText(error)); }
  finally { $('summarize').disabled = false; }
};
window.kairos.load().then(value => { state = value; fill(); renderHistory(); if (!state.hasKey) showSettings(true); }).catch(e => toast(errorText(e)));
