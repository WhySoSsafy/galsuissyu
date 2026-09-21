// The first frame anyone sees, and the name written across the building in it. The view used to
// open on an unremarkable stretch of 둔산 — a place with no relationship to anything the app then
// offers to do.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const map = readFileSync('src/DaejeonMap.tsx', 'utf8');
const landmark = readFileSync('src/station-landmark.ts', 'utf8');
const miniatures = readFileSync('src/city-miniatures.ts', 'utf8');
const explorer = readFileSync('src/CityExplorer.tsx', 'utf8');

const num = (source, name) => Number(source.match(new RegExp(name + '\s*=\s*(-?[0-9.]+)'))?.[1]);
const opening = () => {
  const at = map.indexOf('const OPENING=');
  assert.notEqual(at, -1, 'the opening view should be stated in one place');
  const line = map.slice(at, map.indexOf(';', at));
  const center = line.match(/center:\[(-?[0-9.]+),(-?[0-9.]+)\]/);
  return {
    lon: Number(center[1]), lat: Number(center[2]),
    zoom: Number(line.match(/zoom:(-?[0-9.]+)/)[1]),
    pitch: Number(line.match(/pitch:(-?[0-9.]+)/)[1]),
    bearing: line.match(/bearing:([A-Za-z_]+)/)?.[1],
  };
};

test('it opens where a visitor actually arrives', () => {
  const view = opening();
  // 대전역, the same place the demo run leaves from — the first frame and the first button agree.
  assert.ok(Math.abs(view.lon - 127.4346) < 0.003 && Math.abs(view.lat - 36.3322) < 0.003,
    `opens at ${view.lon},${view.lat}`);
  assert.ok(view.zoom >= 16.8, 'close enough for the building to read as a building');
  assert.match(explorer, /대전역 → 한빛탑 3D로 보기/, 'and the button under it leaves from there');
});

test('the camera meets the face the name is written on', () => {
  // 111.31° was derived from the footprint angle and looked at the back corner. The front is
  // whichever face carries the sign, so the two are defined from one another and cannot drift.
  const view = opening();
  assert.equal(view.bearing, 'STATION_VIEW_BEARING', 'the view angle is named, not a loose number');
  const front = num(landmark, 'STATION_FRONT_BEARING');
  const camera = num(landmark, 'STATION_VIEW_BEARING');
  assert.equal((front + 180) % 360, camera % 360, `a camera at ${camera}° does not face a front at ${front}°`);
  assert.ok(opening().pitch >= 60 && opening().pitch <= 72, 'level enough to see the front, not the roof');
});

test('the name is drawn, spaced and blue', () => {
  assert.match(landmark, /signTexture\('대전역'\)/);
  assert.match(landmark, /color='#[0-9a-f]{6}'/, 'the sign states its own colour');
  const blue = landmark.match(/color='(#[0-9a-f]{6})'/)[1];
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(blue.slice(i, i + 2), 16));
  assert.ok(b > r + 40 && b > g + 40, `${blue} is not blue`);
  assert.match(landmark, /\[\.\.\.text\]\.join/, 'spaced the way a station sign spaces it');
});

test('the sign is put on the building rather than floating near it', () => {
  assert.match(landmark, /group\.rotation\.z=stationAngle/, 'it takes the building’s own rotation');
  assert.match(miniatures, /station\.position\.copy\(local\(stationLocation\)\)/);
  assert.match(miniatures, /station\.visible=map\.getZoom\(\)>=/, 'and it goes away when too far to read');
});

test('nothing added here claims to be a survey', () => {
  // Every model in this project carries the same warning; a nicer building is still not evidence
  // that anyone can get into it.
  assert.match(landmark, /not evidence about getting/);
});

test('no debugging hook ships', () => {
  for (const [name, source] of [['DaejeonMap', map], ['city-miniatures', miniatures]]) {
    assert.ok(!/__map|__station|__scene/.test(source), `${name} still exposes a tuning hook`);
    assert.ok(!source.includes('TUNING'), `${name} still has the note saying to remove it`);
  }
});
