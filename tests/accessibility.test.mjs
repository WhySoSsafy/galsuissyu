// An app about getting into places has to be enterable itself. These pin the things that were
// actually wrong, measured in the browser, so they cannot quietly come back.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';

const explorer = readFileSync('src/CityExplorer.tsx', 'utf8');
const css = readdirSync('src').filter((f) => f.endsWith('.css')).map((f) => readFileSync('src/' + f, 'utf8')).join('\n');

const relativeLuminance = (hex) => {
  const channels = [0, 2, 4].map((i) => parseInt(hex.replace('#', '').slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

test('white text on the arrival colour is readable', () => {
  // #ce6b51 gave 3.59:1. Small text needs 4.5, and 도착 is 13px.
  const arrival = css.match(/\.dj-row-actions \.is-end\{background:(#[0-9a-f]{6})/)?.[1];
  assert.ok(arrival, 'the arrival button should state its own colour');
  const ratio = contrast('#ffffff', arrival);
  assert.ok(ratio >= 4.5, `white on ${arrival} is ${ratio.toFixed(2)}:1`);
});

test('muted text clears the small-text threshold', () => {
  // The greys used for a place's district and category were 3.26:1 on white.
  for (const grey of ['#87927e', '#7d8c84', '#86927b', '#8a978e']) {
    assert.ok(!css.includes(grey), `${grey} is only ${contrast(grey, '#ffffff').toFixed(2)}:1 on white`);
  }
});

test('the endpoint buttons are a reachable size', () => {
  assert.match(css, /\.dj-detail-actions button,\.dj-row-actions button\{min-height:44px\}/,
    'the pair was 40px, under the smallest reliably hittable target');
});

test('a keyboard can reach the map without crossing the whole page', () => {
  assert.match(explorer, /className="skip-link"/);
  assert.match(explorer, /href="#dj-map-region"/);
  assert.match(explorer, /id="dj-map-region"/, 'the skip target has to exist');
  assert.match(css, /\.skip-link:focus\{top:0\}/, 'and it has to become visible when focused');
});

test('the page has exactly one top-level heading', () => {
  const h1 = explorer.match(/<h1\b/g) ?? [];
  assert.equal(h1.length, 1, `found ${h1.length} h1 elements`);
});

test('the document declares its language', () => {
  assert.match(readFileSync('index.html', 'utf8'), /<html lang="ko">/);
});

test('a close button receives its own clicks', () => {
  // The survey's art panel is painted after the close button and was taking them: pressing the
  // middle of the × hit the illustration, and only the top few pixels closed anything.
  const css = readFileSync('src/city-explorer.css', 'utf8');
  const at = css.indexOf('.dj-survey-close{');
  assert.notEqual(at, -1);
  const rule = css.slice(at, css.indexOf('}', at));
  assert.match(rule, /z-index:\s*[1-9]/, 'it has to sit above the panel it is on');
  assert.match(rule, /width:44px/, 'and be a reachable size');
  assert.match(rule, /height:44px/);
});

test('the film is reachable from the header', () => {
  const explorer = readFileSync('src/CityExplorer.tsx', 'utf8');
  const header = explorer.slice(explorer.indexOf('dj-header'), explorer.indexOf('</header>'));
  assert.match(header, /dj-intro-link/, 'a visitor who skipped it should be able to go back');
  assert.match(header, /'\/intro'/, 'and it uses the address, not just state');
});
