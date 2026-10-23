const $ = id => document.getElementById(id);
let state, busy = false, sending = false, previousLength = null, timeline = [], pendingText = null;
let expressionOptions = [], expressionImages = {}, expression = {id:'normal',locked:false};
let previousCharacter=null,accessories=[],drafts={};
function closeAccessories(){$('accessory-panel').hidden=true;}
function renderAccessories(){const list=$('accessory-options');list.replaceChildren();for(const item of accessories){const button=document.createElement('button');button.type='button';button.dataset.accessory=item.id;button.disabled=!item.image;button.setAttribute('aria-pressed',String(item.enabled));button.textContent=(item.enabled?'✓ ':'')+item.label;button.onclick=async()=>{try{const value=await window.kairos.toggleAccessory(item.id);receiveArtwork(value);closeAccessories();}catch(error){$('notice').textContent=errorText(error);}};list.append(button);}if(state?.tarotAvailable){const button=document.createElement('button');button.id='draw-card';button.textContent='Draw A Card';button.disabled=busy;button.onclick=async()=>{try{await window.kairos.tarotOpen();closeAccessories();}catch(e){$('notice').textContent=errorText(e);}};list.append(button);}}
function receiveArtwork(value){expressionOptions=value.expressionOptions;expressionImages=value.expressionImages;accessories=value.accessories||[];receive(value);createWheel();renderAccessories();}
$('accessory-toggle').onclick=()=>{closeWheel();$('accessory-panel').hidden=!$('accessory-panel').hidden;};
$('accessory-close').onclick=closeAccessories;
$('character-toggle').onclick=()=>window.kairos.openSettings();
$('cat-toggle').onclick=async()=>{try{await window.kairos.enterCat();}catch(error){$('notice').textContent=errorText(error);}};
$('companion-toggle').onclick=()=>window.kairos.openCompanion();
window.kairos.onCompanionState(value=>{$('companion-toggle').textContent=value.enabled?'陪伴中':'陪伴';});
function updateExpression(value) {
  expression = value;
  $('expression-toggle').textContent = value.locked ? '表情 · 固定' : '切换表情';
  $('expression-toggle').title = value.locked ? '手动表情保持中，选 Normal 恢复自动' : '自动表情模式';
  for (const button of $('wheel-options').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.expression === value.id));
}
function closeWheel() { $('expression-wheel').hidden = true; $('expression-toggle').setAttribute('aria-expanded','false'); $('expression-toggle').focus(); }
function createWheel() {
  const area = $('wheel-options'); area.replaceChildren();
  const outer = expressionOptions.filter(item=>item.id !== 'normal');
  for (const item of expressionOptions) {
    const button = document.createElement('button'); button.type = 'button'; button.className = `wheel-option${item.id === 'normal' ? ' wheel-normal' : ''}`;
    button.dataset.expression = item.id; button.disabled = !item.available;
    button.setAttribute('aria-label',item.id === 'normal' ? 'Normal，恢复自动表情及眨眼' : `${item.label}，手动保持`);
    const thumb = document.createElement('span'); thumb.className = 'wheel-thumb';
    const image = document.createElement('img'); image.src = expressionImages[item.id] || expressionImages.normal; image.alt = '';
    thumb.append(image);
    const label = document.createElement('span'); label.className = 'wheel-label'; label.textContent = item.label;
    button.append(thumb,label);
    if (item.id !== 'normal') { const angle = outer.indexOf(item) / outer.length * Math.PI * 2 - Math.PI / 2; button.style.left = `${150 + Math.cos(angle)*101}px`; button.style.top = `${122 + Math.sin(angle)*91}px`; }
    button.onclick = async () => { try { updateExpression(await window.kairos.selectExpression(item.id)); closeWheel(); } catch(error) { $('notice').textContent = errorText(error); } };
    area.append(button);
  }
  updateExpression(expression);
}
$('expression-toggle').onclick = () => {
  closeAccessories();
  if (!$('expression-wheel').hidden) { closeWheel(); return; }
  $('expression-wheel').hidden = false; $('expression-toggle').setAttribute('aria-expanded','true');
  $('wheel-options').querySelector('button:not(:disabled)')?.focus();
};
$('wheel-close').onclick = closeWheel;
document.addEventListener('keydown',event=>{
  if(event.key==='Escape')closeAccessories();
  if ($('expression-wheel').hidden) return;
  if (event.key === 'Escape') { event.preventDefault(); closeWheel(); }
  if (event.key === 'Tab') {
    const buttons = [...$('expression-wheel').querySelectorAll('button:not(:disabled)')];
    const index = buttons.indexOf(document.activeElement);
    event.preventDefault(); buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
  }
});
window.kairos.onExpression(updateExpression);
const errorText = error => error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
function renderBubbles() {
  const entries = [...timeline, ...(pendingText ? [{role:'user',content:pendingText,pending:true}] : [])].slice(-3);
  const area = $('bubbles'); area.replaceChildren();
  for (const entry of entries) {
    const bubble = document.createElement('div');
    bubble.className = `bubble ${entry.role}${entry.pending ? ' pending' : ''}`;
    bubble.setAttribute('aria-label', entry.role === 'user' ? 'Creator' : state?.config.characterName||'角色');
    bubble.textContent = entry.content; area.append(bubble);
  }
}
function setBusy(value) { busy = value; $('send').disabled = value; $('summarize').disabled = value; $('cancel').hidden = !value; }
function receive(value) {
  if(previousCharacter!==value.characterId){if(previousCharacter!==null)drafts[previousCharacter]=$('input').value;$('input').value=drafts[value.characterId]||'';previousLength=null;timeline=[];pendingText=null;previousCharacter=value.characterId;$('notice').textContent='';}
  state = {...state,...value}; setBusy(value.busy);document.querySelector('.desktop-chat').style.height=`${value.subtitleChatHeight||300}px`;$('input').placeholder=`和 ${value.config.characterName||'角色'} 说点什么…`;document.title=`${value.config.characterName} · Desktop-company`;renderAccessories();document.querySelector('.toolbar span').textContent=value.config.characterName||'角色';
  $('cat-toggle').hidden=!value.catAvailable;$('cat-toggle').disabled=value.busy;
  if (value.expression) updateExpression(value.expression);
  if (previousLength === null || value.history.length < previousLength) { timeline = value.history.slice(-3); pendingText = null; }
  else if (value.history.length > previousLength) {
    const added = value.history.slice(previousLength);
    if (pendingText && added.some(entry => entry.role === 'user' && entry.content === pendingText)) pendingText = null;
    timeline = [...timeline, ...added].slice(-3);
  }
  previousLength = value.history.length; renderBubbles();
}
window.kairos.onState(receive);
window.kairos.onArtwork(receiveArtwork);
window.kairos.onLocalLine(value=>{timeline=[...timeline,{role:'assistant',content:value.text}].slice(-3);renderBubbles();});
window.kairos.onGreeting(value => {
  if (!busy && !sending) { timeline = [...timeline, {role:'assistant',content:value.text || 'Creator，我在。'}].slice(-3); $('notice').textContent = ''; renderBubbles(); }
  $('input').focus();
});
$('composer').onsubmit = async event => {
  event.preventDefault(); const text = $('input').value.trim(); if (!text || busy || sending) return;
  if (!state?.hasKey) { window.kairos.openSettings(); $('notice').textContent = '先在设置中填写 API 密钥。'; return; }
  sending = true; pendingText = text; setBusy(true); renderBubbles(); $('notice').textContent = `${state.config.characterName} 正在回复…`;
  try { const result = await window.kairos.send(text); receive({...state,history:result.history,busy:false}); $('input').value = ''; $('notice').textContent = ''; }
  catch(error) { pendingText = null; renderBubbles(); $('notice').textContent = errorText(error); }
  finally { sending = false; setBusy(false); $('input').focus(); }
};
$('input').onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); $('composer').requestSubmit(); } };
$('settings').onclick = () => window.kairos.openSettings();
$('close').onclick = () => window.kairos.hideChat();
$('cancel').onclick = () => window.kairos.cancel();
$('summarize').onclick = async () => {
  if (busy) return; setBusy(true); $('notice').textContent = '正在回顾对话并保存记忆…';
  try { const result = await window.kairos.summarize(); receive(result); $('notice').textContent = result.summaryMessage; }
  catch(error) { $('notice').textContent = errorText(error); }
  finally { setBusy(false); }
};
window.kairos.load().then(receiveArtwork).catch(error => $('notice').textContent = errorText(error));
