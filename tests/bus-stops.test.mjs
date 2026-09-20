// 대전광역시_시내버스 기반정보 is a stop register. It was fetched hoping for low-floor routes and
// does not have them, so these pin what it is actually used for and stop the claim creeping back in.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';

const path = 'public/data/bus-stops.json';
const snapshot = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;

test('the snapshot exists and says where it came from', () => {
  assert.ok(snapshot, `${path} is missing; run node scripts/build-bus-stops.mjs`);
  assert.match(snapshot.source, /공공데이터포털/);
  assert.match(snapshot.note, /저상버스 여부는 이 파일에 없습니다/, 'the limit has to travel with the data');
});

test('every stop can actually be placed on the map', () => {
  // A stop with no usable coordinate is dropped rather than put somewhere wrong.
  const outside = snapshot.stops.filter(
    (s) => !(s.lon > 127.21 && s.lon < 127.58 && s.lat > 36.15 && s.lat < 36.54),
  );
  assert.equal(outside.length, 0, `${outside.length} stops fall outside Daejeon`);
  assert.ok(snapshot.stops.length > 2000, `only ${snapshot.stops.length} stops`);
});

test('the arrival display is recorded as a fact, not read as accessibility', () => {
  // 'O' means the display is installed. Anything else means it is not registered — which is not the
  // same as the stop being unusable, and the wording in the app keeps that distinction.
  const flags = new Set(snapshot.stops.map((s) => typeof s.arrivalDisplay));
  assert.deepEqual([...flags], ['boolean']);
  const withDisplay = snapshot.stops.filter((s) => s.arrivalDisplay).length;
  assert.equal(withDisplay, snapshot.counts.arrivalDisplay);
  assert.ok(withDisplay > 0 && withDisplay < snapshot.stops.length, 'both states should be present');

  const explorer = readFileSync('src/CityExplorer.tsx', 'utf8');
  assert.match(explorer, /버스안내단말기는 등록되어 있지 않아요/, 'absence is reported as unregistered');
  assert.ok(!/저상/.test(explorer.slice(explorer.indexOf('includeBusStops'), explorer.indexOf('includeTourPlaces'))),
    'nothing in this file may claim low-floor service from a stop register');
});
