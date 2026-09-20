// Real provider answers, shipped with the build, for the journeys people actually ask for. They
// exist so the simulation — the thing this project is judged on — does not depend on someone
// else's uptime or on an allowance that runs out mid-session.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';

const file = 'public/data/recorded-routes.json';
const transit = readFileSync('src/TransitOptions.tsx', 'utf8');
const lookup = readFileSync('src/recorded-routes.ts', 'utf8');

test('the recordings are shipped and are real answers', () => {
  assert.ok(existsSync(file), `${file} is missing — run scripts/fetch-recorded-routes.mjs`);
  const data = JSON.parse(readFileSync(file, 'utf8'));
  assert.ok(data.journeys.length >= 8, `only ${data.journeys.length} journeys recorded`);
  assert.match(data.source, /ODsay/);
  assert.ok(Date.parse(data.recordedAt), 'when it was recorded, so staleness is visible');

  for (const j of data.journeys) {
    const playable = j.routes.find((r) => r.id === j.playableRouteId);
    assert.ok(playable, `${j.to.name}: the route named as playable has to be in the list`);
    assert.ok(playable.mapObj, `${j.to.name}: a playable route needs its shape`);
    assert.ok(j.geometry.features.length >= 1, `${j.to.name}: no line to draw`);
    assert.ok(playable.legs.length >= 2, `${j.to.name}: a transit journey is more than one leg`);
    // Nothing invented: a recorded leg carries no accessibility claim the provider did not make.
    assert.ok(playable.legs.every((l) => l.accessibility === 'unknown'), `${j.to.name}: claims accessibility`);
  }
});

test('the places recorded are ones the app can actually name', () => {
  // The lookup keys on the place name, so a recording for a name the app never produces is dead
  // weight that would silently never match.
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const known = new Set();
  for (const f of ['public/data/places.json', 'public/data/tour-places.json']) {
    for (const p of (JSON.parse(readFileSync(f, 'utf8')).places ?? [])) known.add(p.name);
  }
  for (const extra of ['한빛탑', '한밭수목원', '대전시립미술관', '대전엑스포시민광장']) known.add(extra);
  for (const j of data.journeys) {
    assert.ok(known.has(j.from.name), `${j.from.name} is not a name the app produces`);
    assert.ok(known.has(j.to.name), `${j.to.name} is not a name the app produces`);
  }
});

test('a recording is used before the provider is called, and says so', () => {
  assert.match(transit, /const journey=live\?null:findRecorded\(library,from,to,mode\);/, 'search consults the library first');
  assert.match(transit, /setFromRecording\(true\)/, 'and the panel says the answer is recorded');
  assert.match(transit, /저장해 둔 실제 조회 결과예요/, 'in words, not just internally');
  assert.match(transit, /지금 이 순간의 운행 정보는 아니에요/, 'without implying it is current');
});

test('live running information is still one press away', () => {
  // The note used to say a repeat search would fetch live data. Once searching answered from the
  // recording that stopped being true, so asking for it is now its own deliberate action.
  assert.match(transit, /async function search\(live=false\)/);
  assert.match(transit, /onClick=\{\(\)=>search\(true\)\}/, 'a button that bypasses the recording');
  assert.ok(!transit.includes('다시 찾으면 지금의 운행 정보를 조회해요'),
    'and the claim that was no longer true is gone');
});

test('a name that matches but a place that does not is rejected', () => {
  assert.match(lookup, /metresApart\(j\.from,from\)<=SAME_PLACE&&metresApart\(j\.to,to\)<=SAME_PLACE/,
    'two places can share a name in different districts');
  assert.match(lookup, /export const SAME_PLACE=(\d+)/);
  const limit = Number(lookup.match(/export const SAME_PLACE=(\d+)/)[1]);
  assert.ok(limit > 0 && limit <= 600, `${limit}m is not "the same place"`);
});

test('a missing recording file is not mistaken for one', () => {
  // The single-page fallback answers any unknown path with index.html and a 200.
  assert.match(lookup, /includes\('json'\)/);
});
