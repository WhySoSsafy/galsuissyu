// Korea Tourism Organization audio guides (Odii) for Daejeon.
//
// Our own first screen reports the gap this fills: of the places recorded in Daejeon, none has a
// hearing or vision guide registered in the barrier-free records. A spoken guide is an access
// route into a place for someone who cannot read a sign, and the script behind it is one for
// someone who cannot hear it. The Organization has both, and they were not being used.
//
// The service has no area filter, so the whole catalogue is paged and cut to Daejeon by coordinate.
//
// Usage: node scripts/fetch-audio-guides.mjs   (needs TOUR_API_KEY)
import {writeFile, mkdir} from 'node:fs/promises';
import {readFileSync} from 'node:fs';

const env = {
  ...Object.fromEntries(
    readFileSync('.env.local', 'utf8').split(/\r?\n/)
      .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
  ),
  ...process.env,
};
if (!env.TOUR_API_KEY) { console.error('TOUR_API_KEY가 없어요. .env.local을 확인해 주세요.'); process.exit(1); }

// The same box the app uses to decide whether a point is in the city.
const IN_DAEJEON = (x, y) => x > 127.21 && x < 127.58 && y > 36.15 && y < 36.54;

const get = async (op, params) => {
  const u = new URL('https://apis.data.go.kr/B551011/Odii/' + op);
  u.searchParams.set('serviceKey', env.TOUR_API_KEY);
  u.searchParams.set('MobileOS', 'ETC');
  u.searchParams.set('MobileApp', 'galsuissyu');
  u.searchParams.set('_type', 'json');
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(u, { signal: AbortSignal.timeout(30000) });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { throw Error(`응답을 읽지 못했어요: ${text.slice(0, 120)}`); }
    // The portal answers a per-second limit with its own envelope; wait and ask again rather than
    // dropping the page, which is how 151 records went missing the last time.
    const code = data?.response?.header?.resultCode ?? data?.resultCode;
    if (code === '22' || code === '23') { await new Promise((r) => setTimeout(r, 1200 * (attempt + 1))); continue; }
    if (code && code !== '0000') throw Error(`${code} ${data?.response?.header?.resultMsg ?? data?.resultMsg ?? ''}`);
    const item = data?.response?.body?.items?.item;
    return { rows: item ? (Array.isArray(item) ? item : [item]) : [], total: Number(data?.response?.body?.totalCount ?? 0) };
  }
  throw Error('재시도해도 응답을 받지 못했어요.');
};

const SIZE = 100;
const { total } = await get('storyBasedList', { numOfRows: 1, pageNo: 1, langCode: 'ko' });
const pages = Math.ceil(total / SIZE);
console.log(`Odii 오디오 스토리 ${total.toLocaleString()}건 · ${pages}페이지에서 대전만 추려요\n`);

const guides = [];
for (let page = 1; page <= pages; page++) {
  const { rows } = await get('storyBasedList', { numOfRows: SIZE, pageNo: page, langCode: 'ko' });
  for (const s of rows) {
    const lon = Number(s.mapX), lat = Number(s.mapY);
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || !IN_DAEJEON(lon, lat)) continue;
    const script = (s.script ?? '').replace(/\s+/g, ' ').trim();
    if (!script) continue;                       // Nothing to read aloud and nothing to read.
    guides.push({
      id: String(s.stid ?? `${s.tid}-${s.stlid}`),
      place: (s.title ?? '').trim(),
      title: (s.audioTitle ?? '').trim(),
      script,
      seconds: Number(s.playTime) || null,
      audio: (s.audioUrl ?? '').trim() || null,  // Empty for most; the script is read aloud instead.
      lon, lat,
    });
  }
  if (page % 10 === 0 || page === pages) process.stdout.write(`\r   ${page}/${pages}페이지 · 대전 ${guides.length}건`);
}
console.log();

if (!guides.length) { console.error('\n대전 오디오 가이드를 찾지 못했어요.'); process.exit(1); }

// One place can carry several stops; keep them together and ordered.
guides.sort((a, b) => a.place.localeCompare(b.place, 'ko') || a.title.localeCompare(b.title, 'ko'));
const places = new Set(guides.map((g) => g.place));
const withAudio = guides.filter((g) => g.audio).length;

const snapshot = {
  source: '한국관광공사 관광지 오디오 가이드(Odii) · 공공데이터포털',
  fetchedAt: new Date().toISOString(),
  guides,
};
await mkdir('public/data', { recursive: true });
await writeFile('public/data/audio-guides.json', JSON.stringify(snapshot));
const size = (JSON.stringify(snapshot).length / 1024).toFixed(0);
console.log(`\n저장: public/data/audio-guides.json · ${guides.length}건 / 장소 ${places.size}곳 · 음성 파일 ${withAudio}건 · ${size}KB`);
