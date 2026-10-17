const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, screen, safeStorage, dialog, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { PROVIDERS, SAMPLE_PERSONA, readJSON, writeJSON, buildMessages, complete, summarizeHistory } = require('./core.cjs');
const { DEFAULT_GREETINGS, pickGreeting } = require('./greetings.cjs');
const { EXPRESSIONS, validExpression, parseExpressionReply, ExpressionController } = require('./expressions.cjs');
const {ACCESSORIES,headpatReaction,greetingAllowed,sample}=require('./interactions.cjs');
const {ASSET_IDS,validSlot,syncSlot,activate,migrateCharacters,CharacterFiles}=require('./characters.cjs');
app.setName('Kairos Desktop');
const root = path.join(__dirname, '..');
// Keep private runtime data outside the source tree, including in development.
app.setPath('userData', process.env.KAIROS_DATA_DIR || path.join(app.getPath('appData'), 'KairosDesktop'));
let pet, chat, subtitle, tray, config, history, active, dragOrigin, dragTimer, testing = false;
let expressionController, characterFiles, topmostTimer, lastPatFinished=0, patActive=false,patSafetyTimer;
const SUBTITLE_WIDTH = 380, SUBTITLE_HEIGHT = 300;
const dataFile = name => path.join(app.getPath('userData'), name);
function privateFolder() { return app.isPackaged ? path.join(path.dirname(app.getPath('exe')), 'private') : path.join(root, 'private'); }
function defaults() {
  const personaFile = path.join(privateFolder(), 'persona.txt');
  return { provider: 'deepseek', ...PROVIDERS.deepseek, about: '', memory: '', worldbook: '', summaryCursor: 0, manualExpression: 'normal', greetingCooldownMinutes:15, greetingGroups: structuredClone(DEFAULT_GREETINGS), persona: fs.existsSync(personaFile) ? fs.readFileSync(personaFile, 'utf8') : SAMPLE_PERSONA, size: 270, alwaysOnTop: true, profiles: {} };
}
function publicState() {
  const profile = config.profiles[config.provider] || {};
  const profiles = Object.fromEntries(Object.entries(config.profiles).map(([name, value]) => [name, { model: value.model, hasKey: Boolean(value.key) }]));
  return { config: { ...config, profiles, characters:undefined }, characterId:config.activeCharacter, slots:config.characters.map((item,index)=>({index,name:item.characterName,ready:Boolean(assetFile(index,'normal')),image:imageURL(assetFile(index,'normal'))})), expression: expressionController.state(), hasKey: Boolean(profile.key), history, busy: Boolean(active || testing), providers: PROVIDERS };
}
function assetFile(index,id){
 const custom=characterFiles.asset(index,id);if(custom)return custom;
 if(index!==0)return '';
 const legacy=path.join(privateFolder(),['ears','scarf','sweater'].includes(id)?'accessories':'expressions',id+'.png');
 return fs.existsSync(legacy)?legacy:'';
}
function imageURL(file){return file?pathToFileURL(file).href+'?v='+fs.statSync(file).mtimeMs:'';}
function expressionArtwork() {
  const fallback = config.activeCharacter===0&&fs.existsSync(path.join(privateFolder(), 'kairos.png')) ? imageURL(path.join(privateFolder(), 'kairos.png')) : pathToFileURL(path.join(__dirname, 'assets', 'placeholder.svg')).href;
  const images = Object.fromEntries([...EXPRESSIONS.map(item=>item.id), 'blink-half', 'blink-closed'].map(id=>{
    const file = assetFile(config.activeCharacter,id);
    return [id, file ? imageURL(file) : (id === 'normal' ? fallback : '')];
  }));
  return { images, options: EXPRESSIONS.map(item=>({...item, available:Boolean(images[item.id])})), accessories:ACCESSORIES.map(item=>({id:item.id,label:item.label,image:imageURL(assetFile(config.activeCharacter,item.id)),enabled:Boolean(config.accessories?.[item.id])})) };
}
function viewState(){const art=expressionArtwork();return {...publicState(),image:art.images.normal,expressionImages:art.images,expressionOptions:art.options,accessories:art.accessories};}
function refreshArtwork(){for(const win of [pet,subtitle,chat])if(win&&!win.isDestroyed())win.webContents.send('artwork',viewState());}
function publishExpression(value) { for (const win of [pet, subtitle]) if (win && !win.isDestroyed()) win.webContents.send('expression', value); }
function broadcast() { for (const win of [pet, chat, subtitle]) if (win && !win.isDestroyed()) win.webContents.send('state', publicState()); }
function setPetPosition(x, y) {
  const width = config.size, height = Math.round(config.size * 1.2);
  const area = screen.getDisplayNearestPoint({ x: Math.round(x + width / 2), y: Math.round(y + height / 2) }).workArea;
  const reserve = subtitle?.isVisible() ? SUBTITLE_HEIGHT + 4 : 0;
  pet.setBounds({ x: Math.round(Math.max(area.x, Math.min(x, area.x + area.width - width))), y: Math.round(Math.max(area.y, Math.min(y, area.y + area.height - height - reserve))), width, height });
  dockSubtitle();
}
function dockSubtitle() {
  if (!subtitle) return;
  const p = pet.getBounds(), area = screen.getDisplayMatching(p).workArea;
  subtitle.setBounds({ x: Math.round(Math.max(area.x, Math.min(p.x + (p.width - SUBTITLE_WIDTH) / 2, area.x + area.width - SUBTITLE_WIDTH))), y: p.y + p.height + 4, width: SUBTITLE_WIDTH, height: SUBTITLE_HEIGHT });
}
function showSubtitle(greeting = true,focus = true) {
  const alreadyVisible=subtitle.isVisible();
  pet.showInactive();
  if(focus)subtitle.show();else subtitle.showInactive();
  const p = pet.getBounds(); setPetPosition(p.x, p.y);
  if(focus)subtitle.focus();
  if (greeting && !alreadyVisible && !active && greetingAllowed(config)) {
    config.lastGreetingAt=Date.now();store();
    subtitle.webContents.send('greeting', pickGreeting(config.greetingGroups));
  }
  maintainTopmost();
}
function getKey() {
  const encrypted = config.profiles[config.provider]?.key;
  if (!encrypted) return '';
  try { return safeStorage.decryptString(Buffer.from(encrypted, 'base64')); }
  catch { throw new Error('无法解密保存的密钥，请在设置中重新填写。'); }
}
function persistConfig(next){syncSlot(next);writeJSON(dataFile('settings.json'),next);characterFiles.saveCard(next.activeCharacter,next.characters[next.activeCharacter]);config=next;}
function store() { persistConfig(config); }
function historyFile(){return characterFiles.historyFile(config.activeCharacter);}
function maintainTopmost(){for(const win of [pet,subtitle,chat])if(win&&!win.isDestroyed()){
 win.setAlwaysOnTop(config.alwaysOnTop,config.alwaysOnTop?'screen-saver':'normal');
 if(config.alwaysOnTop&&win.isVisible())win.moveTop();
}}
function localLine(text){showSubtitle(false,false);subtitle.webContents.send('local-line',{text});}
function windowOptions(extra) {
  return { ...extra, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } };
}
function secureWindow(win) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
}
function showChat(settings = false) {
  const area = screen.getDisplayMatching(pet.getBounds()).workArea;
  const p = pet.getBounds();
  chat.setPosition(Math.max(area.x, Math.min(p.x - 455, area.x + area.width - 440)), Math.max(area.y, Math.min(p.y - 150, area.y + area.height - 650)));
  chat.show(); chat.focus();
  if (settings) chat.webContents.send('settings');
}
function petMenu() {
  Menu.buildFromTemplate([
    { label: '和 Kairos 聊天', click: () => showSubtitle() },
    { label: '查看聊天记录', click: () => showChat() },
    { label: '设置 / 关于我 / 记忆', click: () => showChat(true) },
    {label:'角色槽位 / 导入图片',click:()=>showChat(true)},
    { label: '显示角色', click: () => pet.show() },
    { label: '暂时隐藏', click: () => { pet.hide(); chat.hide(); subtitle.hide(); } },
    { type: 'separator' }, { label: '退出 Kairos', click: () => app.quit() }
  ]).popup();
}
function createWindows() {
  const area = screen.getPrimaryDisplay().workArea;
  pet = new BrowserWindow(windowOptions({ width: config.size, height: Math.round(config.size * 1.2), x: area.x + area.width - config.size - 60, y: Math.max(area.y, area.y + area.height - Math.round(config.size * 1.2) - SUBTITLE_HEIGHT - 28), frame: false, transparent: true, thickFrame: false, resizable: false, maximizable: false, skipTaskbar: true, alwaysOnTop: config.alwaysOnTop, show: false }));
  subtitle = new BrowserWindow(windowOptions({ width: SUBTITLE_WIDTH, height: SUBTITLE_HEIGHT, frame: false, transparent: true, thickFrame: false, resizable: false, maximizable: false, skipTaskbar: true, alwaysOnTop: config.alwaysOnTop, show: false }));
  chat = new BrowserWindow(windowOptions({ width: 440, height: 650, minWidth: 380, minHeight: 500, title: 'Kairos · 聊一会儿', backgroundColor: '#f5f8fb', show: false, autoHideMenuBar: true, alwaysOnTop: config.alwaysOnTop }));
  secureWindow(pet); secureWindow(chat); secureWindow(subtitle);
  subtitle.loadFile(path.join(__dirname, 'subtitle.html'));
  dockSubtitle();
  for (const win of [pet, subtitle]) { win.webContents.setZoomFactor(1); win.webContents.on('zoom-changed', () => win.webContents.setZoomFactor(1)); }
  pet.loadFile(path.join(__dirname, 'pet.html'));
  chat.loadFile(path.join(__dirname, 'index.html'));
  pet.once('ready-to-show', () => pet.showInactive());
  chat.on('close', event => { if (!app.isQuitting) { event.preventDefault(); chat.hide(); } });
  chat.once('ready-to-show', () => { if (!config.profiles[config.provider]?.key && !process.argv.includes('--smoke-test')) showChat(true); });
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.png'));
  tray = new Tray(icon);
  tray.setToolTip('Kairos Desktop · 点击聊天，右键菜单');
  tray.on('click', () => showSubtitle());
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示 Kairos', click: () => pet.show() },
    { label: '打开桌面字幕', click: () => showSubtitle() },
    { label: '查看聊天记录', click: () => showChat() },
    { label: '设置', click: () => showChat(true) },
    { label: '退出', click: () => app.quit() }
  ]));
  for(const win of [pet,subtitle,chat]){win.on('show',maintainTopmost);win.on('restore',maintainTopmost);}
  maintainTopmost();topmostTimer=setInterval(maintainTopmost,2000);
  if (process.argv.includes('--smoke-test') && process.env.KAIROS_DATA_DIR) runSmokeTest();
}
async function runSmokeTest() {
  try {
    await Promise.all([pet, chat, subtitle].map(win => win.webContents.isLoading() ? new Promise(resolve => win.webContents.once('did-finish-load', resolve)) : Promise.resolve()));
    await new Promise(resolve => setTimeout(resolve, 700));
    await chat.webContents.executeJavaScript(`if(document.getElementById('settings').hidden) document.getElementById('settings-toggle').click()`);
    const errors = [];
    const result = await chat.webContents.executeJavaScript(`(async () => {
      const before = await window.kairos.load();
      await window.kairos.save({...before.config, memory: '测试记忆：喜欢薄荷', worldbook: '世界书测试：SIMS 学院', apiKey: ''});
      const after = await window.kairos.load();
      return { title: document.title, settingsVisible: !document.getElementById('settings').hidden, memorySaved: after.config.memory === '测试记忆：喜欢薄荷', privatePersonaLoaded: after.config.persona.length > 5000, hasKey: after.hasKey };
    })()`);
    if (!result.memorySaved || !result.settingsVisible) errors.push('settings or persistence failed');
    const saved = readJSON(dataFile('settings.json'), {});
    if (saved.memory !== '测试记忆：喜欢薄荷') errors.push('disk persistence failed');
    const petState = await pet.webContents.executeJavaScript(`({width:document.getElementById('portrait').naturalWidth, height:document.getElementById('portrait').naturalHeight})`);
    if (!petState.width) errors.push('portrait failed to load');
    const capturePath = path.join(app.getPath('userData'), 'settings-preview.png');
    fs.writeFileSync(capturePath, (await chat.webContents.capturePage()).toPNG());
    fs.writeFileSync(path.join(app.getPath('userData'), 'pet-preview.png'), (await pet.webContents.capturePage()).toPNG());
    let sentMessages;
    const originalFetch = global.fetch;
    global.fetch = async (_url, options) => {
      sentMessages = JSON.parse(options.body).messages;
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'Creator，测试完成。薄荷糖可不算测试费用。' } }] }) };
    };
    const integration = await chat.webContents.executeJavaScript(`(async () => {
      const current = await window.kairos.load();
      await window.kairos.save({...current.config, apiKey: 'fake-smoke-key-not-real'});
      await window.kairos.send('本地测试消息');
      const after = await window.kairos.load();
      return { messages: after.history.length, keySaved: after.hasKey, lastReply: after.history.at(-1).content };
    })()`);
    if (integration.messages < 2 || !integration.keySaved || !sentMessages[0].content.includes('喜欢薄荷')) errors.push('chat integration failed');
    if (fs.readFileSync(dataFile('settings.json'), 'utf8').includes('fake-smoke-key-not-real')) errors.push('key stored as plaintext');
    global.fetch = async () => ({ ok: false, status: 401 });
    const failure = await chat.webContents.executeJavaScript(`(async () => {
      try { await window.kairos.send('不该保存的失败消息'); } catch {}
      return (await window.kairos.load()).history.length;
    })()`);
    if (failure !== integration.messages) errors.push('failed turn modified history');
    global.fetch = originalFetch;
    const persistedChat = readJSON(historyFile(), []);
    if (persistedChat.length !== integration.messages) errors.push('chat persistence failed');
    let chatExpressionRequests = 0;
    global.fetch = async (_url, options) => {
      const payload = JSON.parse(options.body);
      const summarizing = payload.messages[0].content.includes('记忆整理器');
      if (!summarizing) chatExpressionRequests++;
      return { ok: true, json: async () => ({ choices: [{ message: { content: summarizing ? JSON.stringify({ memory: '测试记忆：Creator 喜欢薄荷；Kairos 是虚构角色。' }) : 'Creator，桌面字幕测试完成。这次只说话。\n[[expression:happy]]' } }] }) };
    };
    const summary = await subtitle.webContents.executeJavaScript(`window.kairos.summarize().then(value => ({memory:value.config.memory,cursor:value.config.summaryCursor}))`);
    if (summary.cursor !== history.length || !summary.memory.includes('Creator')) errors.push('summary persistence failed');
    showSubtitle();
    await subtitle.webContents.executeJavaScript(`document.getElementById('input').value='字幕输入测试';document.getElementById('composer').requestSubmit()`);
    await new Promise(resolve => setTimeout(resolve, 400));
    const subtitleState = await subtitle.webContents.executeJavaScript(`({bubbles:[...document.querySelectorAll('.bubble')].map(e=>({text:e.textContent,role:e.classList.contains('user')?'user':'assistant',bg:getComputedStyle(e).backgroundColor})),input:document.getElementById('input').value})`);
    if (subtitleState.bubbles.length !== 3 || !subtitleState.bubbles[2].text.includes('桌面字幕测试') || subtitleState.input || subtitleState.bubbles.some(item=>item.bg !== 'rgb(255, 255, 255)') || subtitleState.bubbles.map(item=>item.role).join(',') !== 'assistant,user,assistant') errors.push('three-bubble chat failed');
    for (let turn = 0; turn < 3; turn++) {
      await subtitle.webContents.executeJavaScript(`document.getElementById('input').value='循环测试';document.getElementById('composer').requestSubmit()`);
      await new Promise(resolve=>setTimeout(resolve,120));
      const count = await subtitle.webContents.executeJavaScript(`document.querySelectorAll('.bubble').length`);
      if (count !== 3) errors.push('bubble cap failed');
    }
    const beforeDrag = pet.getBounds();
    const beforePanel = await subtitle.webContents.executeJavaScript(`({width:document.querySelector('.desktop-chat').getBoundingClientRect().width,height:document.querySelector('.desktop-chat').getBoundingClientRect().height})`);
    const beforeImage = await pet.webContents.executeJavaScript(`({width:document.getElementById('portrait').getBoundingClientRect().width,height:document.getElementById('portrait').getBoundingClientRect().height})`);
    const originalCursor = screen.getCursorScreenPoint;
    let fakeCursor = { x: 900, y: 500 };
    screen.getCursorScreenPoint = () => fakeCursor;
    await pet.webContents.executeJavaScript(`window.kairos.drag('start')`);
    await new Promise(resolve => setTimeout(resolve, 50));
    let stableSize = true;
    for (let step = 1; step <= 100; step++) {
      fakeCursor = { x: 900 - step * 4, y: 500 - step };
      await new Promise(resolve => setTimeout(resolve, 20));
      const bounds = pet.getBounds();
      if (Math.abs(bounds.width - config.size) > 3 || Math.abs(bounds.height - Math.round(config.size * 1.2)) > 3) stableSize = false;
      const panel = subtitle.getBounds();
      if (Math.abs(panel.width - SUBTITLE_WIDTH) > 3 || Math.abs(panel.height - SUBTITLE_HEIGHT) > 3) stableSize = false;
    }
    await pet.webContents.executeJavaScript(`window.kairos.drag('end')`);
    screen.getCursorScreenPoint = originalCursor;
    const afterDrag = pet.getBounds();
    const afterImage = await pet.webContents.executeJavaScript(`({width:document.getElementById('portrait').getBoundingClientRect().width,height:document.getElementById('portrait').getBoundingClientRect().height})`);
    const afterPanel = await subtitle.webContents.executeJavaScript(`({width:document.querySelector('.desktop-chat').getBoundingClientRect().width,height:document.querySelector('.desktop-chat').getBoundingClientRect().height})`);
    stableSize = stableSize && beforeImage.width === afterImage.width && beforeImage.height === afterImage.height;
    stableSize = stableSize && beforePanel.width === afterPanel.width && beforePanel.height === afterPanel.height;
    if (!stableSize || afterDrag.x === beforeDrag.x || Math.abs(subtitle.getBounds().y - afterDrag.y - afterDrag.height - 4) > 2) errors.push('drag or docking regression');
    fs.writeFileSync(path.join(app.getPath('userData'), 'subtitle-preview.png'), (await subtitle.webContents.capturePage()).toPNG());
    const expressionChecks = { automatic: expressionController.state() };
    if (expressionChecks.automatic.id !== 'happy' || history.at(-1).content.includes('[[expression:')) errors.push('expression metadata handling failed');
    await new Promise(resolve=>setTimeout(resolve,5200));
    expressionChecks.afterExpiry = expressionController.state();
    if (expressionChecks.afterExpiry.id !== 'normal') errors.push('automatic expression did not expire');
    await subtitle.webContents.executeJavaScript(`document.getElementById('expression-toggle').click()`);
    await new Promise(resolve=>setTimeout(resolve,80));
    const wheelImages = await subtitle.webContents.executeJavaScript(`({count:document.querySelectorAll('#wheel-options button').length,loaded:[...document.querySelectorAll('#wheel-options img')].every(img=>img.complete && img.naturalWidth>0)})`);
    expressionChecks.wheelImages = wheelImages;
    if (wheelImages.count !== 9 || !wheelImages.loaded) errors.push('wheel previews failed');
    fs.writeFileSync(path.join(app.getPath('userData'), 'wheel-preview.png'), (await subtitle.webContents.capturePage()).toPNG());
    await subtitle.webContents.executeJavaScript(`document.querySelector('#wheel-options [data-expression="angry"]').click()`);
    await new Promise(resolve=>setTimeout(resolve,100));
    await pet.webContents.executeJavaScript(`window.__expressionFrames=[];window.__expressionObserver=new MutationObserver(()=>window.__expressionFrames.push(document.getElementById('portrait').dataset.frame));window.__expressionObserver.observe(document.getElementById('portrait'),{attributes:true,attributeFilter:['src']})`);
    await new Promise(resolve=>setTimeout(resolve,5200));
    await subtitle.webContents.executeJavaScript(`document.getElementById('input').value='手动表情锁定测试';document.getElementById('composer').requestSubmit()`);
    await new Promise(resolve=>setTimeout(resolve,200));
    expressionChecks.manual = expressionController.state();
    expressionChecks.framesWhileLocked = await pet.webContents.executeJavaScript(`window.__expressionFrames`);
    expressionChecks.savedManual = readJSON(dataFile('settings.json'), {}).manualExpression;
    if (!expressionChecks.manual.locked || expressionChecks.manual.id !== 'angry' || expressionChecks.savedManual !== 'angry' || expressionChecks.framesWhileLocked.some(frame=>frame!=='angry')) errors.push('manual lock or pause blink failed');
    fs.writeFileSync(path.join(app.getPath('userData'), 'angry-preview.png'), (await pet.webContents.capturePage()).toPNG());
    await subtitle.webContents.executeJavaScript(`document.getElementById('expression-toggle').click();document.querySelector('#wheel-options [data-expression="normal"]').click()`);
    await new Promise(resolve=>setTimeout(resolve,100));
    expressionChecks.unlocked = expressionController.state();
    if (expressionChecks.unlocked.locked || expressionChecks.unlocked.id !== 'normal') errors.push('Normal did not unlock');
    expressionChecks.portraitDebug = await pet.webContents.executeJavaScript(`({hidden:document.hidden,frame:document.getElementById('portrait').dataset.frame,expression:currentExpression,animator:animator ? {expression:animator.expression,paused:animator.paused,timers:animator.timers.size} : null})`);
    const normalFrames = await pet.webContents.executeJavaScript(`new Promise(resolve=>{const frames=[];const image=document.getElementById('portrait');const observer=new MutationObserver(()=>frames.push(image.dataset.frame));observer.observe(image,{attributes:true,attributeFilter:['src']});setTimeout(()=>{observer.disconnect();resolve(frames)},6500)})`);
    expressionChecks.normalFrames = normalFrames;
    if (!normalFrames.includes('blink-half') || !normalFrames.includes('blink-closed') || !normalFrames.includes('normal')) errors.push('normal blink failed');
    if (chatExpressionRequests !== 5) errors.push('unexpected extra expression request');
    expressionChecks.chatRequests = chatExpressionRequests;
    const featureChecks={};
    for(const id of ['ears','scarf','sweater'])await subtitle.webContents.executeJavaScript(`window.kairos.toggleAccessory(${JSON.stringify(id)})`);
    await new Promise(resolve=>setTimeout(resolve,250));
    featureChecks.layers=await pet.webContents.executeJavaScript(`['ears','scarf','sweater'].map(id=>({id,visible:!document.getElementById('layer-'+id).hidden,loaded:document.getElementById('layer-'+id).naturalWidth===1024}))`);
    if(featureChecks.layers.some(item=>!item.visible||!item.loaded))errors.push('accessory layer failed');
    fs.writeFileSync(dataFile('accessory-preview.png'),(await pet.webContents.capturePage()).toPNG());
    for(let step=0;step<5;step++){
      const x=[.3,.5,.3,.5,.3][step];
      await pet.webContents.executeJavaScript(`(()=>{const rect=document.querySelector('.portrait-stage').getBoundingClientRect(),side=Math.min(rect.width,rect.height);document.getElementById('pet').dispatchEvent(new PointerEvent('pointermove',{clientX:rect.left+(rect.width-side)/2+side*${x},clientY:rect.top+(rect.height-side)/2+side*.30,bubbles:true,buttons:0}));})()`);
      await new Promise(resolve=>setTimeout(resolve,220));
      if(step===3)featureChecks.duringPat=expressionController.state().id;
    }
    await new Promise(resolve=>setTimeout(resolve,750));
    featureChecks.patLine=await subtitle.webContents.executeJavaScript(`document.querySelector('#bubbles .bubble:last-child')?.textContent`);
    if(featureChecks.duringPat!=='smile'||!require('./interactions.cjs').GENTLE.some(item=>item[1]===featureChecks.patLine))errors.push('headpat gesture failed');
    await subtitle.webContents.executeJavaScript(`window.__greetings=0;window.kairos.onGreeting(()=>window.__greetings++)`);
    subtitle.hide();showSubtitle();await new Promise(resolve=>setTimeout(resolve,60));
    featureChecks.cooldownCount=await subtitle.webContents.executeJavaScript(`window.__greetings`);
    if(featureChecks.cooldownCount!==0)errors.push('greeting cooldown failed');
    config.lastGreetingAt=0;config.lastConversationAt=Date.now()-16*60000;subtitle.hide();showSubtitle();await new Promise(resolve=>setTimeout(resolve,60));
    featureChecks.afterCooldown=await subtitle.webContents.executeJavaScript(`window.__greetings`);
    if(featureChecks.afterCooldown!==1)errors.push('greeting cooldown did not release');
    config.worldbook='共享世界书测试';config.about='共享用户信息测试';store();
    const originalPersona=config.persona,originalMemory=config.memory,originalHistory=history.length;
    characterFiles.installImage(1,'normal',assetFile(0,'normal'));
    await subtitle.webContents.executeJavaScript(`window.kairos.switchCharacter(1)`);
    await new Promise(resolve=>setTimeout(resolve,180));
    featureChecks.slot2={history:history.length,worldbook:config.worldbook,about:config.about,name:config.characterName};
    if(history.length||config.worldbook!=='共享世界书测试'||config.about!=='共享用户信息测试')errors.push('character isolation failed');
    await subtitle.webContents.executeJavaScript(`(async()=>{const value=await window.kairos.load();return window.kairos.save({...value.config,characterName:'测试角色二',persona:'我是独立的第二个角色。',memory:'第二个角色独立记忆',apiKey:''})})()`);
    await subtitle.webContents.executeJavaScript(`window.kairos.switchCharacter(0)`);
    featureChecks.restored=config.persona===originalPersona&&config.memory===originalMemory&&history.length===originalHistory;
    if(!featureChecks.restored)errors.push('original character not restored');
    featureChecks.topmost={pet:pet.isAlwaysOnTop(),subtitle:subtitle.isAlwaysOnTop(),settings:chat.isAlwaysOnTop()};
    if(!featureChecks.topmost.pet||!featureChecks.topmost.subtitle||!featureChecks.topmost.settings)errors.push('topmost flag failed');
    if(chatExpressionRequests!==5)errors.push('local interactions made API calls');
    global.fetch = originalFetch;
    await chat.webContents.executeJavaScript(`document.getElementById('settings-toggle').click()`);
    fs.writeFileSync(path.join(app.getPath('userData'), 'chat-preview.png'), (await chat.webContents.capturePage()).toPNG());
    writeJSON(dataFile('smoke-result.json'), { result, petState, integration, summary, subtitleState, expressionChecks,featureChecks, drag: {beforeDrag, afterDrag, beforeImage, afterImage, beforePanel, afterPanel, stableSize}, errors, capturePath });
    app.exit(errors.length ? 1 : 0);
  } catch(error) { writeJSON(dataFile('smoke-result.json'), { error: error.message, stack: error.stack }); app.exit(1); }
}
function handlers() {
  ipcMain.handle('load', viewState);
  ipcMain.handle('select-expression', (_, id) => {
    if (!validExpression(id) || !expressionArtwork().images[id]) throw new Error('这个表情的图片尚未准备好。');
    patActive=false;clearTimeout(patSafetyTimer);
    const next = { ...config, manualExpression: id };
    persistConfig(next);
    return expressionController.selectManual(id);
  });
  ipcMain.handle('switch-character',(_,index)=>{
    if(active||testing)throw new Error('请等当前请求结束后再切换角色。');
    if(!validSlot(index))throw new Error('请选择有效槽位。');
    if(index===config.activeCharacter)return viewState();
    store();characterFiles.saveHistory(config.activeCharacter,history);
    const next=structuredClone(config);activate(next,index);persistConfig(next);
    history=characterFiles.loadHistory(index);
    expressionController.dispose();expressionController=new ExpressionController({manual:config.manualExpression,onChange:publishExpression});
    patActive=false;clearTimeout(patSafetyTimer);clearInterval(dragTimer);dragOrigin=null;
    refreshArtwork();broadcast();return viewState();
  });
  ipcMain.handle('import-image',async(_,value)=>{
    if(active||testing)throw new Error('请等当前请求结束后再更换图片。');
    if(!validSlot(value?.slot)||!ASSET_IDS.includes(value?.asset))throw new Error('角色或图片类型无效。');
    let source=value.filePath;
    if(!source){const result=await dialog.showOpenDialog(chat,{title:'选择透明 PNG',properties:['openFile'],filters:[{name:'PNG 图片',extensions:['png']}]});if(result.canceled)return null;source=result.filePaths[0];}
    if(typeof source!=='string'||path.extname(source).toLowerCase()!=='.png'||fs.statSync(source).size>20*1024*1024)throw new Error('请选择 20 MB 以内的 PNG。');
    const check=nativeImage.createFromPath(source),size=check.getSize();
    if(check.isEmpty()||size.width>4096||size.height>4096||size.width<32||size.height<32)throw new Error('图片无法读取，或尺寸不在 32～4096 像素范围内。');
    characterFiles.installImage(value.slot,value.asset,source);refreshArtwork();broadcast();return viewState();
  });
  ipcMain.handle('character-folder',()=>shell.openPath(characterFiles.folder(config.activeCharacter)));
  ipcMain.handle('export-character',async()=>{
    const result=await dialog.showOpenDialog(chat,{title:'选择保存角色素材包的位置',properties:['openDirectory','createDirectory']});
    if(result.canceled)return '已取消。';
    const index=config.activeCharacter,folder=characterFiles.exportCard(index,config.characters[index],result.filePaths[0]);
    // Include legacy bundled art for the built-in character as well as custom overrides.
    for(const id of ASSET_IDS){const source=assetFile(index,id);if(source)fs.copyFileSync(source,path.join(folder,'assets',id+'.png'));}
    return '已导出人设和图片，不包含密钥、聊天、世界书或用户信息。';
  });
  ipcMain.handle('import-character',async()=>{
    if(active||testing)throw new Error('请等当前请求结束。');
    const result=await dialog.showOpenDialog(chat,{title:'选择角色素材包文件夹',properties:['openDirectory']});if(result.canceled)return null;
    const folder=result.filePaths[0],card=readJSON(path.join(folder,'character.json'),null);
    if(!card||typeof card.name!=='string'||typeof card.persona!=='string'||!card.persona.trim()||card.persona.length>50000)throw new Error('素材包需要有效的 character.json（name 与 persona）。');
    const index=config.activeCharacter;
    const answer=await dialog.showMessageBox(chat,{type:'question',buttons:['取消','导入此槽位'],defaultId:0,cancelId:0,message:'用素材包替换当前槽位的人设和同名图片？',detail:'世界书、用户信息和本槽位聊天记忆会保留。'});if(answer.response!==1)return null;
    // Fixed filenames only: no paths from the manifest are executed or followed.
    const images=[];for(const id of ASSET_IDS){const file=path.join(folder,'assets',id+'.png');if(fs.existsSync(file)){const image=nativeImage.createFromPath(file);const size=image.getSize();if(fs.statSync(file).size>20*1024*1024||image.isEmpty()||size.width>4096||size.height>4096)throw new Error('素材包中有无效图片。');images.push([id,file]);}}
    for(const [id,file]of images)characterFiles.installImage(index,id,file);
    config.characterName=card.name.slice(0,80);config.persona=card.persona;store();refreshArtwork();broadcast();return viewState();
  });
  ipcMain.handle('accessory',(_,id)=>{
    const item=ACCESSORIES.find(item=>item.id===id);if(!item||!assetFile(config.activeCharacter,id))throw new Error('这个角色还没有对应饰品图片。');
    config.accessories={...config.accessories,[id]:!config.accessories?.[id]};store();refreshArtwork();broadcast();
    if(config.accessories[id])localLine(sample(item.lines));
    return viewState();
  });
  ipcMain.on('headpat',(event,value)=>{
    if(event.sender!==pet.webContents||!value)return;
    const armSafety=()=>{clearTimeout(patSafetyTimer);patSafetyTimer=setTimeout(()=>{patActive=false;expressionController.endTemporary();},1800);};
    if(value.phase==='start'){
      if(Date.now()-lastPatFinished<1500)return;
      patActive=true;armSafety();const images=expressionArtwork().images;expressionController.temporary(images.smile?'smile':images.happy?'happy':'normal',0);
    }else if(value.phase==='continue'&&patActive)armSafety();
    else if(value.phase==='end'&&patActive){
      patActive=false;clearTimeout(patSafetyTimer);lastPatFinished=Date.now();
      const reaction=headpatReaction(value.kind==='rough'?'rough':'gentle');
      expressionController.temporary(expressionArtwork().images[reaction.expression]?reaction.expression:'normal',5000);localLine(reaction.text);
    }else if(value.phase==='cancel'&&patActive){patActive=false;clearTimeout(patSafetyTimer);expressionController.endTemporary();}
  });
  ipcMain.handle('save', (_, value) => {
    if (active || testing) throw new Error('请等当前请求结束后再保存设置。');
    if (!value || !PROVIDERS[value.provider]) throw new Error('请选择有效的服务商。');
    for (const field of ['model', 'about', 'memory', 'persona', 'worldbook']) if (typeof value[field] !== 'string' || value[field].length > 50000) throw new Error('设置内容过长或格式不正确。');
    for (const group of Object.keys(DEFAULT_GREETINGS)) if (!Array.isArray(value.greetingGroups?.[group]) || value.greetingGroups[group].length > 50 || value.greetingGroups[group].some(text => typeof text !== 'string' || text.length > 1000)) throw new Error('问候语格式不正确。');
    const next = structuredClone(config);
    next.profiles[config.provider] = { ...config.profiles[config.provider], model: config.model };
    next.provider = value.provider;
    next.base = PROVIDERS[value.provider].base;
    for (const field of ['model', 'about', 'memory', 'persona', 'worldbook']) next[field] = value[field].trim();
    next.greetingGroups = structuredClone(value.greetingGroups);
    if(typeof value.characterName==='string'&&value.characterName.trim())next.characterName=value.characterName.trim().slice(0,80);
    next.greetingCooldownMinutes=Math.max(10,Math.min(20,Number(value.greetingCooldownMinutes)||15));
    if (!next.model || !next.persona) throw new Error('模型名称和角色设定不能为空。');
    next.size = Math.max(160, Math.min(420, Number(value.size) || 270));
    next.alwaysOnTop = Boolean(value.alwaysOnTop);
    if (value.apiKey) {
      if (typeof value.apiKey !== 'string' || value.apiKey.length > 4096) throw new Error('密钥格式不正确。');
      if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows 密钥保护尚不可用，无法保存。');
      next.profiles[next.provider] = { ...next.profiles[next.provider], key: safeStorage.encryptString(value.apiKey.trim()).toString('base64') };
    }
    next.profiles[next.provider] = { ...next.profiles[next.provider], model: next.model };
    persistConfig(next);
    const p = pet.getBounds();
    setPetPosition(p.x, p.y);
    maintainTopmost();
    broadcast();
    return publicState();
  });
  ipcMain.handle('test', async () => {
    if (active || testing) throw new Error('当前正在请求，请稍等。');
    testing = true; broadcast();
    try { await complete({ config, key: getKey(), messages: [{ role: 'user', content: 'Reply OK.' }], maxTokens: 16 }); return '连接成功，可以开始聊天。'; }
    catch (error) { throw new Error(friendlyError(error)); }
    finally { testing = false; broadcast(); }
  });
  ipcMain.handle('send', async (_, text) => {
    if (active || testing) throw new Error('请等当前请求结束。');
    if (typeof text !== 'string' || !text.trim() || text.length > 10000) throw new Error('请输入 1～10000 字的消息。');
    const controller = new AbortController(); active = controller; broadcast();
    try {
      const rawAnswer = await complete({ config, key: getKey(), messages: buildMessages(config, history, text.trim()), signal: controller.signal });
      const { answer, expression } = parseExpressionReply(rawAnswer);
      const time = new Date().toISOString();
      const next = [...history, { role: 'user', content: text.trim(), time }, { role: 'assistant', content: answer, expression, time }];
      writeJSON(historyFile(), next); history = next;
      config.lastConversationAt=Date.now();store();
      expressionController.automatic(expressionArtwork().images[expression] ? expression : 'normal');
      return { answer, history, expression: expressionController.state() };
    } catch (error) { throw new Error(friendlyError(error)); }
    finally { active = null; broadcast(); }
  });
  ipcMain.handle('cancel', () => active?.abort());
  ipcMain.handle('toggle-chat', () => subtitle.isVisible()?subtitle.hide():showSubtitle());
  ipcMain.handle('hide-chat', () => subtitle.hide());
  ipcMain.handle('open-settings', () => showChat(true));
  ipcMain.handle('menu', petMenu);
  ipcMain.on('drag', (event, phase) => {
    if (event.sender !== pet.webContents) return;
    if (phase === 'start') {
      clearInterval(dragTimer);
      dragOrigin = { cursor: screen.getCursorScreenPoint(), bounds: pet.getBounds() };
      dragTimer = setInterval(() => {
        if (!dragOrigin) return;
        const cursor = screen.getCursorScreenPoint();
        const dx = cursor.x - dragOrigin.cursor.x, dy = cursor.y - dragOrigin.cursor.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) setPetPosition(dragOrigin.bounds.x + dx, dragOrigin.bounds.y + dy);
      }, 16);
    } else { clearInterval(dragTimer); dragOrigin = null; }
  });
  ipcMain.handle('summarize', async () => {
    if (active || testing) throw new Error('请等当前请求结束。');
    if ((config.summaryCursor || 0) >= history.length) return { ...publicState(), summaryMessage: '没有尚未总结的新对话。' };
    const key = getKey(); if (!key) throw new Error('请先保存 API 密钥。');
    const controller = new AbortController(); active = controller; broadcast();
    try {
      writeJSON(dataFile(`memory-backups/${Date.now()}.json`), { memory: config.memory, summaryCursor: config.summaryCursor });
      const result = await summarizeHistory({ config, history, key, signal: controller.signal, onProgress: value => {
        const next = { ...config, memory: value.memory, summaryCursor: value.summaryCursor };
        persistConfig(next); broadcast();
      } });
      return { ...publicState(), summaryMessage: `已总结并保存长期记忆（${result.batches} 批新对话）。` };
    } catch(error) { throw new Error(friendlyError(error)); }
    finally { active = null; broadcast(); }
  });
  ipcMain.handle('data-folder', () => shell.openPath(app.getPath('userData')));
  ipcMain.handle('export', async () => {
    const result = await dialog.showSaveDialog(chat, { defaultPath: 'Kairos-聊天备份.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (!result.canceled) { writeJSON(result.filePath, { history, memory: config.memory, about: config.about, worldbook: config.worldbook }); return '已导出聊天与记忆（不含密钥）。'; }
    return '已取消导出。';
  });
  ipcMain.handle('clear', async () => {
    if (active || testing) throw new Error('请先结束当前请求。');
    const result = await dialog.showMessageBox(chat, { type: 'question', buttons: ['保留', '清空聊天'], defaultId: 0, cancelId: 0, message: '清空全部聊天记录？', detail: '长期记忆不会清除。如需保留聊天，请先导出备份。' });
    if (result.response === 1) { writeJSON(historyFile(), []); history = []; config.summaryCursor = 0; store(); broadcast(); }
    return publicState();
  });
}
function friendlyError(error) {
  if (error.name === 'AbortError') return '已取消，本次消息没有保存。';
  if (error.name === 'TimeoutError') return '等待回复超时，请稍后重试。';
  if (error.message === 'fetch failed') return '无法连接服务商，请检查网络后重试。';
  return error.message;
}
const isolatedSmoke=process.argv.includes('--smoke-test')&&Boolean(process.env.KAIROS_DATA_DIR);
if (!isolatedSmoke && !app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (pet) showSubtitle(); });
  app.on('before-quit', () => { app.isQuitting = true; clearInterval(dragTimer);clearInterval(topmostTimer);clearTimeout(patSafetyTimer); expressionController?.dispose(); active?.abort(); });
  app.whenReady().then(() => {
    config = { ...defaults(), ...readJSON(dataFile('settings.json'), {}) };
    delete config.greetings; delete config.speakGreetings;
    characterFiles=new CharacterFiles(app.getPath('userData'),path.join(app.isPackaged?path.dirname(app.getPath('exe')):root,'character'));
    migrateCharacters(config);
    history = characterFiles.loadHistory(config.activeCharacter,dataFile('chat.json'));
    if (!validExpression(config.manualExpression) || !expressionArtwork().images[config.manualExpression]) config.manualExpression = 'normal';
    expressionController = new ExpressionController({ manual: config.manualExpression, onChange: publishExpression });
    handlers(); createWindows();
  }).catch(error => {if(isolatedSmoke){writeJSON(dataFile('smoke-result.json'),{error:error.message,stack:error.stack});app.exit(1);}else{dialog.showErrorBox('Kairos 启动失败', error.message);app.quit();}});
}
