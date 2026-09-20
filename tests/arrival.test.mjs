// The end of the run, and the point of the whole product. It used to be a strip announcing that a
// preview had finished, laid out by two rulesets that disagreed — an outer flex row from an earlier
// design pulled the heading and the buttons alongside each other and wrapped every label.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const arrival = readFileSync('src/JourneyArrival.tsx', 'utf8');
const explorer = readFileSync('src/CityExplorer.tsx', 'utf8');
const css = readFileSync('src/experience.css', 'utf8');

const ruleFor = (selector) => {
  const at = css.indexOf(selector + '{');
  assert.notEqual(at, -1, `${selector} has no rule`);
  return css.slice(at, css.indexOf('}', at));
};

test('one ruleset lays the card out', () => {
  // Two disagreed: `.journey-arrival{display:flex;align-items:center}` sat the buttons beside the
  // heading while the component had long since become a vertical card.
  // Only one rule may place it; the rest are media queries adjusting width and offset.
  const placing = [...css.matchAll(/\.journey-arrival\{([^}]*)\}/g)].filter((m) => /position:/.test(m[1]));
  assert.equal(placing.length, 1, `${placing.length} rules position the card`);
  for (const [, body] of css.matchAll(/\.journey-arrival\{([^}]*)\}/g)) {
    assert.ok(!/display:flex/.test(body), 'the card is not a row');
  }
  const rule = ruleFor('.journey-arrival');
  assert.match(rule, /box-sizing:border-box/, 'a fixed width plus padding has to stay inside its max-width');
});

test('it cannot grow past the map it sits in', () => {
  const rule = ruleFor('.journey-arrival');
  assert.match(rule, /max-height:calc\(100% - 24px\)/);
  assert.match(rule, /overflow-y:auto/, 'a long card scrolls rather than bleeding off a short screen');
});

test('it says what the run showed, not that it ended', () => {
  assert.match(arrival, /arrival-measures/, 'the numbers behind the claim');
  for (const [key, label] of [['minutes', '걸렸어요'], ['transfers', '갈아타요'], ['walkDistance', '걸어요'], ['fare', '예상 요금']]) {
    assert.ok(arrival.includes(`facts?.${key}`), `${key} is missing`);
    assert.ok(arrival.includes(label), `${label} is missing`);
  }
  assert.match(explorer, /const arrivalFacts=useMemo/, 'and the map supplies them');
  assert.match(explorer, /facts=\{arrivalFacts\} companion=\{companion\}/);
});

test('a missing number is left out rather than guessed', () => {
  // ODsay returns null for a fare or a time it does not have, and a card claiming 0원 would be
  // inventing one.
  assert.match(arrival, /\.filter\(Boolean\)/);
  assert.match(arrival, /facts\?\.minutes!=null/, 'null is absence, not zero');
  assert.match(arrival, /measures\.length>0&&/, 'no numbers at all means no panel');
});

test('the companions chosen in the survey are named back', () => {
  // The whole thesis is that a route is only usable if it is usable for everyone travelling, so
  // arriving should say whose conditions were applied.
  assert.match(arrival, /companions\.find\(c=>c\.key===key\)/);
  assert.match(arrival, /조건으로 찾은 동선이에요/);
  assert.match(arrival, /named\.length\?'다 같이 갈 수 있어요':'갈 수 있어요'/, 'and not claim a group that was never chosen');
});

test('it still refuses to claim more than it checked', () => {
  assert.match(arrival, /실제 이동이 아니라/, 'a preview is not a trip');
  assert.match(arrival, /저상버스 배차와 승강기 운영, 실시간 도착은 확인하지 않았어요/);
});

test('every control is reachable and the motion is optional', () => {
  assert.match(ruleFor('.arrival-actions button'), /min-height:44px/);
  const close = ruleFor('.arrival-close');
  assert.match(close, /width:40px/);
  assert.match(close, /z-index:2/, 'it sits above the card body, which once took its clicks');
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.journey-arrival,\.arrival-check\{animation:none\}\}/);
});
