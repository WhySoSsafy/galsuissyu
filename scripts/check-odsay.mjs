// What ODsay itself says about a key, before any of our code touches it.
//
// An ODsay web key is bound to the domains registered for it in their console, and the binding is
// checked against the Referer of the request. Our server builds that header from ODSAY_SERVICE_URI,
// so a key and a domain are one setting, not two: changing the key without registering the domain
// gives [ApiKeyAuthFailed], which looks exactly like a bad key.
//
//   node scripts/check-odsay.mjs                      # the key and domain in .env.local
//   node scripts/check-odsay.mjs <key>                # that key, against every domain worth trying
//   node scripts/check-odsay.mjs <key> <domain>       # one exact pair
import {readFileSync, existsSync} from 'node:fs';

const readEnv = (file) => existsSync(file)
  ? Object.fromEntries(readFileSync(file, 'utf8').split(/\r?\n/)
      .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]))
  : {};

const env = readEnv('.env.local');
const [key = env.ODSAY_API_KEY, only] = process.argv.slice(2);
if (!key) {
  console.error('키가 없어요. node scripts/check-odsay.mjs <key> [domain]');
  process.exit(1);
}
const domains = only ? [only] : [...new Set([env.ODSAY_SERVICE_URI, 'galsuissyu.vercel.app', 'localhost:5173'].filter(Boolean))];

// 대전역 → 한빛탑, the journey the demo plays.
const url = new URL('https://api.odsay.com/v1/api/searchPubTransPathT');
for (const [k, v] of Object.entries({SX: 127.4348, SY: 36.3316, EX: 127.3886, EY: 36.3745, SearchType: 0, SearchPathType: 0, apiKey: key, output: 'json'})) {
  url.searchParams.set(k, String(v));
}

const verdict = (data) => {
  const fault = Array.isArray(data.error) ? data.error[0] : data.error;
  if (!fault) return `OK · 경로 ${data.result?.path?.length ?? 0}개`;
  const code = String(fault.code ?? '?');
  const why = {
    '500': '이 도메인이 키에 등록되어 있지 않아요 (ODsay 콘솔에서 등록하세요)',
    '429': '키는 맞는데 오늘 한도를 다 썼어요',
    '-8': '키는 맞는데 오늘 한도를 다 썼어요',
  }[code] ?? '';
  return `${code} ${fault.message ?? ''}${why ? ' → ' + why : ''}`;
};

console.log(`키 ${key.slice(0, 4)}…${key.slice(-2)} (${key.length}자)\n`);
for (const domain of domains) {
  const origin = 'https://' + domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const response = await fetch(url, {headers: {Referer: origin + '/', Origin: origin}, signal: AbortSignal.timeout(18000)});
  console.log(`  ${domain.padEnd(46)} ${verdict(await response.json())}`);
}
console.log('\n쓸 수 있는 조합이 보이면 ODSAY_API_KEY와 ODSAY_SERVICE_URI를 그 쌍으로 맞추세요.');
console.log('Vercel은 환경변수를 바꾼 뒤 재배포해야 반영돼요: npx vercel --prod --yes');
