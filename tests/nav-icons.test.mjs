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
