// Two Tourism Organization datasets answering what our own map could not: a way into a place for
// someone who cannot read the sign or hear the guide, and the day to go on so the crowd is not the
// thing that stops you.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';

const lookup = readFileSync('src/tour-extras.ts', 'utf8');
const panels = readFileSync('src/PlaceExtras.tsx', 'utf8');
const explorer = readFileSync('src/CityExplorer.tsx', 'utf8');

test('the audio guides are shipped and carry something to play or read', () => {
  assert.ok(existsSync('public/data/audio-guides.json'), 'run scripts/fetch-audio-guides.mjs');
  const data = JSON.parse(readFileSync('public/data/audio-guides.json', 'utf8'));
  assert.match(data.source, /한국관광공사/);
  assert.ok(data.guides.length >= 50, `only ${data.guides.length} guides`);
  for (const g of data.guides) {
    assert.ok(g.script && g.script.length > 40, `${g.place}: nothing to read aloud`);
    assert.ok(g.lon > 127.21 && g.lon < 127.58 && g.lat > 36.15 && g.lat < 36.54, `${g.place} is outside Daejeon`);
  }
  assert.ok(data.guides.some((g) => g.audio), 'some carry a real recording');
});

test('the congestion forecast is shipped, dated, and per attraction', () => {
  assert.ok(existsSync('public/data/congestion.json'), 'run scripts/fetch-congestion.mjs');
  const data = JSON.parse(readFileSync('public/data/congestion.json', 'utf8'));
  assert.ok(data.spots.length >= 50, `only ${data.spots.length} attractions`);
  assert.match(data.covers.from, /^\d{8}$/, 'a forecast has to say when it starts');
  assert.ok(data.covers.days >= 14, 'a week of advice needs more than a week of data');
  for (const s of data.spots) {
    assert.ok(s.rates.length >= 7, `${s.name}: too few days to advise on`);
    assert.ok(s.rates.every((r) => Number.isFinite(r) && r >= 0), `${s.name}: a rate that is not a number`);
  }
  assert.ok(data.weekly.days.length >= 5, 'the city-level weekly pattern is the baseline');
});

test('a loose name match is refused', () => {
  // Proximity alone handed a urology clinic the guide for the cathedral over the road, and a place
  // called "대전" swallowed every record whose name contains it.
  assert.match(lookup, /const SHORTEST_PARTIAL=4;/);
  assert.match(lookup, /Math\.min\(x\.length,y\.length\)>=SHORTEST_PARTIAL/);
  assert.match(lookup, /metres\(g,place\)<=NEAR_ENOUGH&&samePlace\(g\.place,place\.name\)/,
    'a guide needs both the name and the distance');
});

test('a forecast that has run out is not shown as one', () => {
  assert.match(lookup, /\.filter\(d=>d\.date\.getTime\(\)>=/, 'past days are dropped');
  assert.match(lookup, /if\(days\.length<3\)return null;/, 'and a stale file hides the panel');
});

test('advice is only given when the week actually differs', () => {
  // "Go on Tuesday" over a 2% difference is noise dressed as guidance.
  assert.match(lookup, /const meaningful=busiest\.rate-quietest\.rate>=8;/);
  assert.match(panels, /forecast\.meaningful\s*\?/);
  assert.match(panels, /이번 주는 날마다 크게 다르지 않아요/);
});

test('the guide is readable as well as playable', () => {
  // Most records carry only a script. Reading it aloud in the browser is adjustable and needs no
  // bandwidth, and the same words stay on screen for someone who cannot hear them.
  assert.match(panels, /SpeechSynthesisUtterance/);
  assert.match(panels, /say\.lang='ko-KR'/);
  assert.match(panels, /글로 읽기/, 'the script is shown, not just spoken');
  assert.match(panels, /이 브라우저는 읽어주기를 지원하지 않아요/, 'and a browser without a voice says so');
});

test('a voice never outlives the place it belongs to', () => {
  assert.match(panels, /useEffect\(\(\)=>\(\)=>\{try\{speechSynthesis\.cancel\(\)/, 'unmounting stops it');
  assert.match(panels, /\},\[guides\]\);/, 'and so does moving to another place');
});

test('neither panel claims more than the Organization did', () => {
  assert.match(panels, /관광공사가 추정한 예측값이에요/);
  assert.match(panels, /실제 현장 인원이나 대기 시간을 보장하지 않아요/);
  assert.match(panels, /관광공사 오디오 가이드/, 'the guide is theirs, not ours');
});

test('both are wired into the place a visitor is looking at', () => {
  assert.match(explorer, /<CongestionPanel data=\{crowd\} place=\{selected\}\/>/);
  assert.match(explorer, /<AudioGuidePanel guides=\{selectedGuides\}\/>/);
  assert.match(explorer, /loadAudioGuides\(c\.signal\)\.then\(setAudio\)/);
});
