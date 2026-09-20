// Records the demo trip (대전역 → 한빛탑) so the button on the map can play it without calling the
// transit provider at all. A judging session opens that one trip over and over, and the provider's
// daily allowance is finite; this takes it out of the budget entirely and keeps the demo working
// even when the allowance is gone or the provider is down.
//
// The saved answer is a real response, not a hand-written one, and the app labels it as recorded.
//
// Usage: node scripts/fetch-demo-route.mjs   (needs ODSAY_API_KEY, spends two calls)
import {writeFile,mkdir} from 'node:fs/promises';
import {loadEnv} from 'vite';
import {handleTransit} from '../server/transit.mjs';

const env={...loadEnv('development',process.cwd(),''),...process.env};
if(!env.ODSAY_API_KEY){console.error('ODSAY_API_KEY가 없어요. .env.local을 확인해 주세요.');process.exit(1);}

// Kept in step with the demo button in CityExplorer; the names are resolved there from the place data.
const FROM=[127.4345,36.3322];   // 대전역
const TO=[127.3887,36.3745];     // 한빛탑
const MODE='all';

const post=async(path,body)=>{
 const response=await handleTransit(new Request('http://localhost/api/transit/'+path,{method:'POST',body:JSON.stringify(body)}),env);
 const data=await response.json();
 if(!response.ok)throw Error(`${path} ${response.status}: ${data.error??''} (${data.code??''})`);
 return data;
};

const {routes}=await post('routes',{from:FROM,to:TO,mode:MODE});
if(!routes.length)throw Error('경로가 비어 있어요. 좌표를 확인해 주세요.');

// Only the route the button actually plays needs its shape; the rest stay as listed alternatives.
const playable=routes.find(r=>r.mapObj);
if(!playable)throw Error('그릴 수 있는 경로가 없어요.');
const geometry=await post('geometry',{mapObj:playable.mapObj});

const snapshot={
 source:'ODsay 대중교통 경로 · 기록된 응답',
 recordedAt:new Date().toISOString(),
 request:{from:FROM,to:TO,mode:MODE},
 playableRouteId:playable.id,
 routes,
 geometry,
};

await mkdir('public/data',{recursive:true});
await writeFile('public/data/demo-route.json',JSON.stringify(snapshot));
console.log(`저장: public/data/demo-route.json`);
console.log(`경로 ${routes.length}개, 재생 경로 ${playable.id} (${playable.minutes}분, 구간 ${playable.legs.length}개), 선형 ${geometry.features.length}개`);
