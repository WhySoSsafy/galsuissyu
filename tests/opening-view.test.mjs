// The first frame anyone sees. It used to open on an unremarkable stretch of 둔산 — a place with
// no relationship to anything the app then offers to do.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const map = readFileSync('src/DaejeonMap.tsx', 'utf8');
const explorer = readFileSync('src/CityExplorer.tsx', 'utf8');

const opening = () => {
  const at = map.indexOf('const OPENING=');
  assert.notEqual(at, -1, 'the opening view should be stated in one place');
  const line = map.slice(at, map.indexOf(';', at));
  const num = (key) => Number(line.match(new RegExp(key + ':(-?[0-9.]+)'))?.[1]);
  const center = line.match(/center:\[(-?[\d.]+),(-?[\d.]+)\]/);
  return { lon: Number(center[1]), lat: Number(center[2]), zoom: num('zoom'), pitch: num('pitch'), bearing: num('bearing') };
};

test('it opens where a visitor actually arrives', () => {
  const view = opening();
  // 대전역, the same place the demo run starts from — the first frame and the first button agree.
  assert.ok(Math.abs(view.lon - 127.4346) < 0.002 && Math.abs(view.lat - 36.3322) < 0.002,
    `opens at ${view.lon},${view.lat}`);
  assert.ok(view.zoom >= 16.5, 'close enough for the building to read as a building');
  assert.match(explorer, /대전역 → 한빛탑 3D로 보기/, 'and the button under it leaves from there');
});

test('it looks at the front of the station, not down onto its roof', () => {
  const view = opening();
  // The station's long axis runs at 21.31°, so its facade is square on at 111.31°.
  assert.ok(Math.abs(view.bearing - 111.31) < 6, `bearing ${view.bearing} is not facing the facade`);
  assert.ok(view.pitch >= 55, `pitch ${view.pitch} looks at the roof rather than the front`);
  assert.ok(view.pitch <= 70, `pitch ${view.pitch} is past what the tiles can fill`);
});

test('the tuning hook never ships', () => {
  assert.ok(!map.includes('__map'), 'the map instance must not be left on window');
  assert.ok(!map.includes('TUNING'), 'and neither must the note saying to remove it');
});
