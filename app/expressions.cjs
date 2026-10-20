const EXPRESSIONS = [
  { id: 'normal', label: 'Normal' }, { id: 'angry', label: '生气' },
  { id: 'confuse', label: '疑惑' }, { id: 'happy', label: '开心' },
  { id: 'mock', label: '嗤笑' }, { id: 'smirk', label: '坏笑' },
  { id: 'surprised', label: '惊喜' }, { id: 'unhappy', label: '不悦' }, { id: 'smile', label: '微笑' }, { id: 'smile2', label: '微笑 2' }
];
const validExpression = id => EXPRESSIONS.some(item => item.id === id);
function parseExpressionReply(raw) {
  // Only a standalone final control line is metadata. Quoted tags inside dialogue remain dialogue.
  const match = raw.match(/(?:^|\r?\n)\s*\[\[expression:([^\]\r\n]+)\]\]\s*$/i);
  if (!match) return { answer: raw.trim(), expression: 'normal' };
  const answer = raw.slice(0, match.index).trim();
  if (!answer) throw new Error('模型只返回了表情编号，没有台词，请重试。');
  const id = match[1].trim().toLowerCase();
  return { answer, expression: validExpression(id) ? id : 'normal' };
}
const EXPRESSION_RULE = `回复结束后，另起一行输出 [[expression:编号]]，编号只能是 normal/angry/confuse/happy/mock/smirk/surprised/unhappy/smile/smile2，分别对应正常/生气/疑惑/开心/嗤笑/坏笑/惊喜/不悦/微笑/闭眼微笑。按角色此刻自己的反应选择，而非机械匹配用户的情绪关键词。日常自然交流可选 normal，不必每轮夸张。控制行不属于台词，不能在台词里解释编号。不再输出其他表情说明。`;

class ExpressionController {
  constructor({ manual = 'normal', onChange = () => {}, now = Date.now, schedule = setTimeout, cancel = clearTimeout } = {}) {
    this.manual = validExpression(manual) ? manual : 'normal';
    this.id = this.manual; this.expiresAt = 0; this.timer = null; this.overlay=null; this.overlayTimer=null;
    this.onChange = onChange; this.now = now; this.schedule = schedule; this.cancel = cancel;
  }
  state() { return this.overlay ? {...this.overlay,locked:this.manual!=='normal',temporary:true} : { id: this.id, locked: this.manual !== 'normal', expiresAt: this.expiresAt }; }
  clearOverlay(){if(this.overlayTimer!==null)this.cancel(this.overlayTimer);this.overlayTimer=null;this.overlay=null;}
  temporary(id,duration=5000){this.clearOverlay();this.overlay={id:validExpression(id)?id:'normal',expiresAt:duration?this.now()+duration:0};if(duration)this.overlayTimer=this.schedule(()=>{this.overlayTimer=null;this.overlay=null;this.onChange(this.state());},duration);this.onChange(this.state());return this.state();}
  endTemporary(){this.clearOverlay();this.onChange(this.state());}
  clearTimer() { if (this.timer !== null) this.cancel(this.timer); this.timer = null; }
  selectManual(id) {
    if (!validExpression(id)) throw new Error('这个表情不存在。');
    this.clearTimer(); this.clearOverlay(); this.manual = id; this.id = id; this.expiresAt = 0;
    this.onChange(this.state()); return this.state();
  }
  automatic(id) {
    if (this.manual !== 'normal') return this.state();
    this.clearTimer(); this.id = validExpression(id) ? id : 'normal';
    this.expiresAt = this.id === 'normal' ? 0 : this.now() + 5000;
    if (this.expiresAt) this.timer = this.schedule(() => { this.timer = null; this.id = 'normal'; this.expiresAt = 0; this.onChange(this.state()); }, 5000);
    this.onChange(this.state()); return this.state();
  }
  dispose() { this.clearTimer(); this.clearOverlay(); }
}
module.exports = { EXPRESSIONS, validExpression, parseExpressionReply, EXPRESSION_RULE, ExpressionController };
