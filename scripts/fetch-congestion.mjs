// Korea Tourism Organization congestion forecasts for Daejeon attractions, plus the city's
// day-of-week visitor pattern.
//
// Crowding is a physical barrier, and no map treats it as one. Getting a wheelchair through a
// packed plaza, a stroller through a queue, or an older parent through a crowd without being
// knocked is the difference between a place being usable and not — on exactly the same day, at
// exactly the same place. The Organization publishes a daily forecast per attraction; this turns it
// into "go on the quiet day" advice.
//
// Usage: node scripts/fetch-congestion.mjs   (needs TOUR_API_KEY)
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

const DAEJEON = '30';
const GU = [['30110', '동구'], ['30140', '중구'], ['30170', '서구'], ['30200', '유성구'], ['30230', '대덕구']];

const get = async (service, op, params) => {
  const u = new URL(`https://apis.data.go.kr/B551011/${service}/${op}`);
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
    const code = data?.response?.header?.resultCode ?? data?.resultCode;
    if (code === '22' || code === '23') { await new Promise((r) => setTimeout(r, 1200 * (attempt + 1))); continue; }
    if (code && code !== '0000') throw Error(`${code} ${data?.response?.header?.resultMsg ?? data?.resultMsg ?? ''}`);
    const item = data?.response?.body?.items?.item;
    return item ? (Array.isArray(item) ? item : [item]) : [];
  }
  throw Error('재시도해도 응답을 받지 못했어요.');
};

// ── Per-attraction daily forecast
console.log('한국관광공사 관광지 집중률 · 대전 5개 구\n');
const spots = new Map();
for (const [code, name] of GU) {
  let count = 0;
  for (let page = 1; page <= 20; page++) {
    const rows = await get('TatsCnctrRateService', 'tatsCnctrRatedList', { areaCd: DAEJEON, signguCd: code, numOfRows: 100, pageNo: page });
    for (const r of rows) {
      const rate = Number(r.cnctrRate);
      if (!r.tAtsNm || !/^\d{8}$/.test(String(r.baseYmd)) || !Number.isFinite(rate)) continue;
      const key = `${name}|${r.tAtsNm}`;
      if (!spots.has(key)) spots.set(key, { name: r.tAtsNm, district: name, days: {} });
      spots.get(key).days[String(r.baseYmd)] = Math.round(rate * 10) / 10;
    }
    count += rows.length;
    if (rows.length < 100) break;
  }
  console.log(`   ${name.padEnd(4)} ${count}행`);
}

// Store each attraction as a run of days from one start date: shorter, and it keeps the order.
const list = [...spots.values()].map((s) => {
  const dates = Object.keys(s.days).sort();
  return { name: s.name, district: s.district, from: dates[0], rates: dates.map((d) => s.days[d]) };
}).filter((s) => s.rates.length >= 7).sort((a, b) => a.name.localeCompare(b.name, 'ko'));

// ── City-level day-of-week pattern, for the baseline the per-place forecast sits against.
// This service has no area parameter; the rows carry their own region code.
console.log('\n한국관광공사 데이터랩 · 대전 요일별 방문자');
const end = new Date(); end.setDate(end.getDate() - 60);
const start = new Date(end); start.setDate(start.getDate() - 28);
const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
const totals = new Map();
for (let page = 1; page <= 30; page++) {
  const rows = await get('DataLabService', 'metcoRegnVisitrDDList', { startYmd: ymd(start), endYmd: ymd(end), numOfRows: 1000, pageNo: page });
  for (const r of rows) {
    if (String(r.areaCode) !== DAEJEON) continue;
    const n = Number(r.touNum);
    if (!r.daywkDivNm || !Number.isFinite(n)) continue;
    const day = totals.get(r.daywkDivNm) ?? { sum: 0, count: 0 };
    day.sum += n; day.count += 1;
    totals.set(r.daywkDivNm, day);
  }
  if (rows.length < 1000) break;
}
const ORDER = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];
const weekly = ORDER.filter((d) => totals.has(d)).map((d) => ({ day: d, visitors: Math.round(totals.get(d).sum / totals.get(d).count) }));
for (const w of weekly) console.log(`   ${w.day} ${w.visitors.toLocaleString()}`);

if (!list.length) { console.error('\n집중률 데이터를 찾지 못했어요.'); process.exit(1); }

const snapshot = {
  source: '한국관광공사 관광지 집중률 · 데이터랩 지역별 방문자 · 공공데이터포털',
  fetchedAt: new Date().toISOString(),
  // The forecast is a rolling window, so the app hides it once it runs out rather than passing
  // yesterday's prediction off as tomorrow's.
  covers: { from: list[0].from, days: Math.max(...list.map((s) => s.rates.length)) },
  weekly: { period: `${ymd(start)}-${ymd(end)}`, days: weekly },
  spots: list,
};
await mkdir('public/data', { recursive: true });
await writeFile('public/data/congestion.json', JSON.stringify(snapshot));
const size = (JSON.stringify(snapshot).length / 1024).toFixed(0);
console.log(`\n저장: public/data/congestion.json · 관광지 ${list.length}곳 · ${snapshot.covers.from}부터 ${snapshot.covers.days}일 · ${size}KB`);
