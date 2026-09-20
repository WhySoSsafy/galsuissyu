// Records real ODsay answers for the journeys people actually ask for, so the app can play them
// without calling the provider at all.
//
// Two reasons. A judging session opens the same few trips over and over and the provider's daily
// allowance is finite — this takes them out of the budget entirely. And when the allowance is gone,
// the key expires or the provider is down, these still work: the 3D simulation is the thing this
// project is being judged on, and it must not depend on someone else's uptime.
//
// Every saved answer is a real response, and the app labels it as recorded rather than passing it
// off as a live lookup.
//
// Usage: node scripts/fetch-recorded-routes.mjs                     (two provider calls per journey)
//        node scripts/fetch-recorded-routes.mjs 한빛탑                (only journeys matching a name)
//        node scripts/fetch-recorded-routes.mjs --api https://…      (record through a deployment)
//
// --api drives a deployed /api/transit instead of this machine, which is how to record with a key
// that only exists in the deployment's environment. Nothing secret is read, written or passed.
import {writeFile,mkdir} from 'node:fs/promises';
import {loadEnv} from 'vite';
import {handleTransit,serviceHost} from '../server/transit.mjs';

const args=process.argv.slice(2);
const apiAt=args.indexOf('--api');
const api=apiAt===-1?null:args[apiAt+1]?.replace(/\/$/,'');
if(apiAt!==-1){if(!api){console.error('--api 다음에 주소가 필요해요.');process.exit(1);}args.splice(apiAt,2);}
const env={...loadEnv('development',process.cwd(),''),...process.env};
if(!api&&!env.ODSAY_API_KEY){console.error('ODSAY_API_KEY가 없어요. .env.local을 확인하거나 --api로 배포본을 쓰세요.');process.exit(1);}

// 대전역 is where a visitor from outside the city arrives, so it is the origin for all of them.
// The destinations are the places people go, and each one has a 3D model waiting at the end of the
// simulation. Names must match the app's own place names — that is what the lookup keys on.
const ORIGIN={name:'대전역',lon:127.43336,lat:36.33135};
const DESTINATIONS=[
 {name:'한빛탑',lon:127.3880552684057,lat:36.37663863047867,note:'demo'},
 {name:'성심당',lon:127.4272426462,lat:36.3277328597},
 {name:'대전오월드',lon:127.39807,lat:36.28931},
 {name:'한밭수목원',lon:127.386251630496,lat:36.3685826106998},
 {name:'대전시립미술관',lon:127.385704504338,lat:36.366988348016},
 {name:'뿌리공원',lon:127.3864280203,lat:36.2845065219},
 {name:'우암사적공원',lon:127.4589725875,lat:36.3481671989},
 {name:'대청호자연수변공원',lon:127.4747177362,lat:36.3726452347},
 {name:'유성 족욕체험장',lon:127.34543,lat:36.35504},
 {name:'동춘당공원',lon:127.44197,lat:36.36551},
 {name:'장태산 자연휴양림',lon:127.34029,lat:36.21886},
];
const MODE='all';

const filter=args[0];
const wanted=filter?DESTINATIONS.filter(d=>d.name.includes(filter)):DESTINATIONS;
if(!wanted.length){console.error(`"${filter}"에 해당하는 목적지가 없어요.`);process.exit(1);}

const post=async(path,body)=>{
 const request=new Request((api??'http://localhost')+'/api/transit/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const response=api?await fetch(request):await handleTransit(request,env);
 const data=await response.json();
 if(!response.ok)throw Error(`${data.error??''} (${data.code??response.status})`);
 return data;
};

const where=api?await fetch(api+'/api/transit/status').then(r=>r.json()).then(d=>`${api} · ${d.serviceUri}`).catch(()=>api):serviceHost(env);
console.log(`ODsay · ${where} · ${wanted.length}개 여정\n`);
const journeys=[],failed=[];
for(const place of wanted){
 const from=[ORIGIN.lon,ORIGIN.lat],to=[place.lon,place.lat];
 try{
  const {routes}=await post('routes',{from,to,mode:MODE});
  if(!routes.length)throw Error('경로가 비어 있어요');
  // Only the route the app plays needs its shape drawn; the rest stay as listed alternatives.
  const playable=routes.find(r=>r.mapObj);
  if(!playable)throw Error('그릴 수 있는 경로가 없어요');
  const geometry=await post('geometry',{mapObj:playable.mapObj});
  journeys.push({from:ORIGIN,to:{name:place.name,lon:place.lon,lat:place.lat},mode:MODE,playableRouteId:playable.id,routes,geometry});
  console.log(`  ✓ ${place.name.padEnd(12)} ${String(playable.minutes).padStart(3)}분 · 구간 ${playable.legs.length} · 선형 ${geometry.features.length} · 대안 ${routes.length}개`);
 }catch(cause){
  failed.push(place.name);
  console.log(`  ✗ ${place.name.padEnd(12)} ${cause.message}`);
 }
}

if(!journeys.length){console.error('\n저장할 여정이 없어요.');process.exit(1);}

const snapshot={
 source:'ODsay 대중교통 경로 · 기록된 응답',
 recordedAt:new Date().toISOString(),
 journeys,
};
await mkdir('public/data',{recursive:true});
await writeFile('public/data/recorded-routes.json',JSON.stringify(snapshot));
const size=(JSON.stringify(snapshot).length/1024).toFixed(0);
console.log(`\n저장: public/data/recorded-routes.json · ${journeys.length}개 여정 · ${size}KB`);
if(failed.length)console.log(`기록하지 못함: ${failed.join(', ')}`);
