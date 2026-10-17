const DEFAULT_GREETINGS = {
  morning: [
    'Up this early? *yawn* — my alarm hasn’t even had the decency to go off yet.',
    'Morning. You’re up at this hour, so you’re definitely up to something. Take me with you?'
  ],
  midday: [
    'What’s the canteen serving today… ugh. Sod it, I’m getting a burger.',
    'Pizza again… fine. Still better than my cooking. Hope you’re eating something decent—don’t make me worry.'
  ],
  night: [
    'Still awake? Reading, or gaming?',
    'Go lie down. Unless you want to fall asleep on your desk tomorrow.'
  ],
  random: [
    'Mm… hm? Sorry—just dozed off.',
    'I’m reading Kant, Nietzsche, Hegel… Freud? No one with taste reads that vulgar rubbish.',
    'Exams next week, so I’m revising. With my soul. Therefore I don’t need my entire body at the desk.',
    'Football training… if there are no shuttle runs today, I’ll go.',
    'I still haven’t understood a word of *Ulysses*, but that doesn’t stop me from telling everyone it’s garbage.',
    'Every time I pass a mirror I check myself out… and check if anyone’s following me. Ha.',
    'Only tossers undo the top two buttons. So I undo to the third.',
    'Sun’s too bright… *hiss*…',
    'If it rains again today, can we just skip school?',
    'I promise I’ll finish my homework tonight…',
    'Football matches are boring. I mean it.'
  ]
};
function greetingGroup(date = new Date()) {
  const minute = date.getHours() * 60 + date.getMinutes();
  if (minute >= 300 && minute < 480) return 'morning';
  if (minute >= 690 && minute < 780) return 'midday';
  if (minute >= 1320) return 'night';
  return 'random';
}
function pickGreeting(groups, date = new Date(), random = Math.random) {
  const group = greetingGroup(date);
  const entries = groups[group]?.filter(text => text.trim()) || [];
  const pool = entries.length ? entries : groups.random?.filter(text => text.trim()) || [];
  return { group, text: pool.length ? pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))] : 'Creator，我在。' };
}
module.exports = { DEFAULT_GREETINGS, greetingGroup, pickGreeting };
