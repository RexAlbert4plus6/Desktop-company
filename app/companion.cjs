const DEFAULT_LINES={
 browser:['在找什么吗？这里可不一定有你想要的。','Another tab? Is this research, or are we calling it that?','Still browsing? Let me know when you find the meaning of life.'],
 drawing:['今天画得怎么样？我可以安静一点，暂时。','Take your time. I’m not going anywhere.','You look busy. I’ll try not to be a distraction. No promises.'],
 work:['哇哦，你居然开始工作了。我要记住这个历史性时刻。','Actually working? Fine. I’ll behave. For a bit.','别一直盯着它，偶尔也歇一下。'],
 music:['音乐软件都打开了，挑首喜欢的吧。','Music on, then? All right. Set the mood.','Mind if I keep you company? Put something good on.'],
 game:['Playing, then? Go on. I’ll try not to comment on every move.','Good luck. You might need it.','玩一会儿也记得歇歇。眼睛又没有备用的。'],
 general:['我在。你忙你的，不用一直找话题。','Still here, Creator. Terribly persistent of me.','Need a break, or shall I keep quietly judging you?'],
 undo:['手感不好吗？慢慢来，撤回键又不会跑。','That undo key is working overtime. Bad drawing day?','改了又改？好吧，我假装没看见。'],
 oops:['又翻车了？谢谢你专程告诉我，我本来还不知道。','You said it, not me. Shall we call that a warm-up?','好吧，这次算热身。下一次也是的话，我可就要笑了。']
};
const DRAWING=/^(photoshop|illustrator|aseprite|krita|clipstudiopaint|sai2?|paintdotnet|mspaint|firealpaca|medibangpaint|blender)$/i;
const GROUPS={browser:/^(msedge|chrome|firefox|brave|opera|vivaldi|arc|zen)$/,work:/^(winword|excel|powerpnt|onenote|outlook|code|devenv|idea64|pycharm64|afterfx|adobe premiere pro|premiere pro|indesign|figma|notion|obs64)$/,music:/^(spotify|cloudmusic|qqmusic|music.ui|foobar2000|aimp)$/,game:/^(arknights|genshinimpact|yuanshen|starrail|eldenring|cs2|valorant-win64-shipping|league of legends|overwatch|minecraft|terraria|stardew valley|wuthering waves)$/};
const LABELS={browser:'浏览器',drawing:'绘画 / 创作软件',work:'工作软件',music:'音乐软件',game:'游戏',general:'其他软件'};
function classify(app){app=String(app||'').toLowerCase().replace(/\.exe$/,'');if(DRAWING.test(app))return 'drawing';for(const [kind,pattern] of Object.entries(GROUPS))if(pattern.test(app))return kind;return 'general';}
function preferences(value={}){return {dailyLimit:Math.min(100,Math.max(1,Math.round(Number(value.dailyLimit)||30))),cooldown:Math.min(600,Math.max(30,Math.round(Number(value.cooldown)||60))),gameMode:Boolean(value.gameMode),undoEnabled:value.undoEnabled!==false,lines:Object.fromEntries(Object.entries(DEFAULT_LINES).map(([kind,defaults])=>{const lines=Array.isArray(value.lines?.[kind])?value.lines[kind].filter(line=>typeof line==='string').map(line=>line.trim().slice(0,400)).filter(Boolean).slice(0,30):[];return [kind,lines.length?lines:[...defaults]];}))};}
class CompanionSession {
 constructor({prefs,usage,now=Date.now,random=Math.random,persist=()=>{},onChange=()=>{},onSpeak=()=>{},allowed=()=>true}={}){Object.assign(this,{now,random,persist,onChange,onSpeak,allowed});this.prefs=preferences(prefs);this.usage=usage||{};this.enabled=false;this.healthy=false;this.lastSpoken=-Infinity;this.lastText='';this.lastReason='';this.status='陪伴已关闭';this.lastChoice={};this.resetContext();this.rollDay();}
 day(){const date=new Date(this.now());return `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;}
 rollDay(){const day=this.day();if(this.usage.day!==day)this.usage={day,count:0};this.usage.count=Math.max(0,Number(this.usage.count)||0);}
 resetContext(){this.context=null;this.undoTimes=[];this.external=false;this.lastReport=0;}
 state(){this.rollDay();return {enabled:this.enabled,healthy:this.healthy,status:this.status,prefs:this.prefs,count:this.usage.count,remaining:Math.max(0,this.prefs.dailyLimit-this.usage.count),tokens:0,lastText:this.lastText,lastReason:this.lastReason,category:this.context?.kind||'',label:this.context?LABELS[this.context.kind]:'等待目标软件',nextAuto:this.enabled?this.nextAuto:0};}
 notify(){this.onChange(this.state());}
 save(){this.persist({prefs:this.prefs,usage:this.usage});}
 configure(value){this.prefs=preferences(value);this.save();this.notify();return this.state();}
 start(){if(this.enabled)return;this.enabled=true;this.healthy=false;this.resetContext();this.nextAuto=this.now()+600000;this.status='正在启动本地识别…';this.notify();}
 stop(message='陪伴已关闭，软件识别和撤回检测均已停止'){this.enabled=false;this.healthy=false;this.resetContext();this.status=message;this.notify();}
 report(value){if(!this.enabled)return;const now=this.now();this.lastReport=now;this.healthy=true;
  if(value.own){this.external=false;this.undoTimes=[];this.status='陪伴中 · 回到目标软件后继续识别';this.notify();return;}
  if(!value.app||value.valid===false){this.external=false;this.context=null;this.undoTimes=[];this.status='陪伴中 · 暂时无法识别前台软件';this.notify();return;}
  let kind=classify(value.app);if(kind==='general'&&this.prefs.gameMode)kind='game';
  const app=String(value.app).slice(0,100).toLowerCase();if(this.context?.app!==app){this.undoTimes=[];this.context={kind,app,since:now,seen:now};}else Object.assign(this.context,{kind,seen:now});
  this.external=true;this.status=`陪伴中 · ${LABELS[kind]} · 零 token`;
  if(value.undo&&kind==='drawing'&&this.prefs.undoEnabled){this.undoTimes=this.undoTimes.filter(time=>now-time<8000);this.undoTimes.push(now);if(this.undoTimes.length>=4){this.undoTimes=[];this.speak('undo');}}
  this.notify();
 }
 tick(){if(!this.enabled)return;const now=this.now();if(now-this.lastReport>8000){this.healthy=false;this.status='陪伴中 · 等待本地识别信号';this.notify();}
  if(now>=this.nextAuto){this.nextAuto=now+600000;if(this.external&&this.healthy&&this.context&&now-this.context.seen<3000&&now-this.context.since>=5000)this.speak('timer');this.notify();}
 }
 speak(reason='manual'){
  if(!this.enabled)throw Error('请先开启陪伴。');this.rollDay();const now=this.now();
  if(this.usage.count>=this.prefs.dailyLimit)return this.reject('今天的吐槽次数已经用完，识别仍可随时关闭。');
  if(now-this.lastSpoken<this.prefs.cooldown*1000)return this.reject(`冷却中，还需 ${Math.ceil((this.prefs.cooldown*1000-now+this.lastSpoken)/1000)} 秒。`);
  if(!this.allowed())return this.reject('正在聊天或猫猫模式中，先不打扰。');
  if(!this.healthy||!this.context||now-this.context.seen>120000)return this.reject('请先切回目标软件几秒，再点“吐槽一下”。');
  const kind=reason==='undo'?'undo':reason==='oops'?'oops':this.context.kind;
  const lines=this.prefs.lines[kind],choices=lines.filter(line=>line!==this.lastChoice[kind]);const pool=choices.length?choices:lines;
  const text=pool[Math.min(pool.length-1,Math.floor(this.random()*pool.length))];
  this.lastChoice[kind]=text;this.lastSpoken=now;this.usage.count++;this.lastText=text;this.lastReason=reason;this.save();this.onSpeak({text,kind,reason});this.notify();return {spoken:true,text};
 }
 reject(message){return {spoken:false,message};}
}
module.exports={CompanionSession,preferences,classify,DEFAULT_LINES,LABELS};
