// 출발 and 도착 appear in three places that are styled by different files: a search result row, the
// place card, and the popup the map opens on a bare point. They drifted apart once already, so the
// shared pair is asserted rather than eyeballed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const SLATE = '#28485b';
const TERRACOTTA = '#ce6b51';

const experience = readFileSync('src/experience.css', 'utf8');
const mobile = readFileSync('src/mobile-map.css', 'utf8');

const rule = (css, selector) => {
  const at = css.indexOf(selector + '{');
  assert.notEqual(at, -1, `missing rule for ${selector}`);
  return css.slice(at + selector.length + 1, css.indexOf('}', at));
};

test('a departure is slate wherever it is offered', () => {
  const list = rule(experience, '.dj-detail-actions button,.dj-row-actions button');
  assert.ok(list.includes('background:' + SLATE), 'the row and card share one departure colour');
  const popup = rule(mobile, '.map-point-actions button');
  assert.ok(popup.includes('background:' + SLATE), "the map popup's departure must match");
});

test('an arrival is terracotta wherever it is offered', () => {
  const list = rule(experience, '.dj-detail-actions .is-end,.dj-row-actions .is-end');
  assert.ok(list.includes('background:' + TERRACOTTA));
  const popup = rule(mobile, '.map-point-actions button:last-child');
  assert.ok(popup.includes('background:' + TERRACOTTA));
});

test('the 3D run does not borrow either endpoint colour', () => {
  // It is a different kind of action, and wearing 출발's colour would read as a third endpoint.
  const sim = rule(experience, '.dj-detail-actions .is-sim');
  assert.ok(!sim.includes(SLATE) && !sim.includes(TERRACOTTA), `is-sim should be neutral, got ${sim}`);
});
