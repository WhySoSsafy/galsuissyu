// The rail and the phone's bottom bar draw the same four destinations. They were being drawn with
// whatever character came closest, including one emoji, which carries its own colour and ignores the
// text colour around it. These keep the set one set.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const icons = readFileSync('src/icons.tsx', 'utf8');
const explorer = readFileSync('src/CityExplorer.tsx', 'utf8');

const navMarkup = (className) => {
  const at = explorer.indexOf(className);
  assert.notEqual(at, -1, `${className} is missing`);
  return explorer.slice(at, explorer.indexOf('</nav>', at));
};

test('no emoji is used as an interface mark', () => {
  // An emoji renders in its own colour, so a selected item cannot turn its icon white with its label.
  for (const bar of ['desktop-rail', 'dj-mobile-nav']) {
    assert.ok(!/\p{Extended_Pictographic}/u.test(navMarkup(bar)), `${bar} still contains an emoji`);
  }
});

test('every mark takes the colour of the text beside it', () => {
  assert.match(icons, /stroke:'currentColor'/);
  assert.match(icons, /fill:'none'/, 'the set is drawn in line, not filled');
  const drawn = icons.match(/export function \w+Icon/g) ?? [];
  assert.ok(drawn.length >= 4, `expected the four destinations, found ${drawn.length}`);
});

test('the set is drawn at one weight', () => {
  const widths = new Set([...icons.matchAll(/strokeWidth:([\d.]+)/g)].map((m) => m[1]));
  assert.equal(widths.size, 1, `mixed stroke weights: ${[...widths].join(', ')}`);
});

test('the phone and the desktop use the same components', () => {
  const rail = new Set([...navMarkup('desktop-rail').matchAll(/<(\w+Icon) \/>/g)].map((m) => m[1]));
  const bar = new Set([...navMarkup('dj-mobile-nav').matchAll(/<(\w+Icon) \/>/g)].map((m) => m[1]));
  assert.ok(rail.size >= 3 && bar.size >= 4, 'both bars should draw from the set');
  for (const shared of rail) {
    assert.ok(bar.has(shared), `${shared} is on the rail but not in the phone's bar`);
  }
});

// Reads the x extent of a glyph straight out of its source, so changing the drawing changes what is
// measured. Handles the two shapes this set uses: absolute path points and a circle.
function xExtent(body) {
  const xs = [];
  for (const [, cx, r] of body.matchAll(/<circle cx="([\d.]+)" cy="[\d.]+" r="([\d.]+)"/g)) {
    xs.push(Number(cx) - Number(r), Number(cx) + Number(r));
  }
  for (const [, d] of body.matchAll(/<path d="([^"]+)"/g)) {
    let cursor = null;
    for (const token of d.match(/[MLlHhVv]|-?[\d.]+/g) ?? []) {
      if (/^[MLlHhVv]$/.test(token)) { cursor = token; continue; }
      const value = Number(token);
      // Only absolute horizontal positions contribute; the relative arrowheads ride on those.
      if (cursor === 'M' || cursor === 'L' || cursor === 'H') xs.push(value);
      if (cursor === 'M' || cursor === 'L') cursor = cursor === 'M' ? 'L' : 'L';
    }
  }
  return xs.length ? [Math.min(...xs), Math.max(...xs)] : null;
}

test('a nav button centres its icon, not just its label', () => {
  // The rail lays its buttons out with grid. place-content centres the rows as a block; it does not
  // centre what is inside a row. An svg has an intrinsic size, so without justify-items it sits at
  // the start of its column and drifts left by however much wider the label is.
  const experience = readFileSync('src/experience.css', 'utf8');
  const rail = experience.slice(experience.indexOf('.desktop-rail button{'));
  const rule = rail.slice(0, rail.indexOf('}'));
  if (/display:grid/.test(rule)) {
    assert.match(rule, /justify-items:center|place-items:center/, 'a grid rail must centre its items');
  }
  const mobile = readFileSync('src/mobile-map.css', 'utf8');
  const bar = mobile.slice(mobile.indexOf('.dj-mobile-nav button{'));
  const barRule = bar.slice(0, bar.indexOf('}'));
  assert.match(barRule, /align-items:center|justify-items:center|place-items:center/);
});
