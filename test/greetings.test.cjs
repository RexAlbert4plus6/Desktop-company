const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_GREETINGS, greetingGroup, pickGreeting } = require('../app/greetings.cjs');
const at = (hour, minute = 0) => new Date(2026,9,15,hour,minute);
test('time slots use local time with exact half-open boundaries', () => {
  for (const [hour, minute, expected] of [[4,59,'random'],[5,0,'morning'],[7,59,'morning'],[8,0,'random'],[11,29,'random'],[11,30,'midday'],[12,59,'midday'],[13,0,'random'],[21,59,'random'],[22,0,'night'],[23,59,'night'],[0,0,'random']]) assert.equal(greetingGroup(at(hour,minute)), expected);
});
test('all 17 supplied lines remain in their groups, both choices are reachable', () => {
  assert.deepEqual(Object.values(DEFAULT_GREETINGS).map(items=>items.length),[2,2,2,11]);
  assert.match(DEFAULT_GREETINGS.morning[0], /\*yawn\*/);
  assert.match(DEFAULT_GREETINGS.random[4], /\*Ulysses\*/);
  for (const [hour,minute,group] of [[6,0,'morning'],[12,0,'midday'],[23,0,'night'],[15,0,'random']]) {
    assert.equal(pickGreeting(DEFAULT_GREETINGS,at(hour,minute),()=>0).text, DEFAULT_GREETINGS[group][0]);
    assert.equal(pickGreeting(DEFAULT_GREETINGS,at(hour,minute),()=>0.99999).text, DEFAULT_GREETINGS[group].at(-1));
  }
});
