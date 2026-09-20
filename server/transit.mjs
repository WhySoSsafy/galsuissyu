// Provider credentials stay server-side. No route or location logging.
export class TransitError extends Error{constructor(code,message,status=502){super(message);this.code=code;this.status=status;}}
const coord=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=127.21&&p[0]<=127.58&&p[1]>=36.15&&p[1]<=36.54;
const num=v=>v!==null&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
export function normalizePaths(data){
 // ODsay reports failures as an object for routing errors but as an array for account-level ones
 // (quota, key). Reading only the object shape turned "Daily quota exceeded" into an undefined code
 // and a message that blamed the route.
 const fault=Array.isArray(data.error)?data.error[0]:data.error;
 if(fault){
  const code=String(fault.code??'UNKNOWN');
  if(['429','-8','8'].includes(code))throw new TransitError('QUOTA','대중교통 조회 한도를 모두 사용했어요. 내일 다시 이용하거나 보행 경로를 확인해 주세요.',429);
  if(['401','-9','9','-1','1'].includes(code))throw new TransitError('AUTH','대중교통 정보 연결 설정을 확인해야 해요.',502);
  throw new TransitError(code,['-99','-98','3','4','5'].includes(code)?'이 구간의 대중교통 경로를 찾지 못했어요. 가까운 지점은 보행 경로를 확인해 주세요.':'교통 정보 제공처에서 조회를 완료하지 못했어요.',422);
 }
 if(data.result?.searchType&&data.result.searchType!==0)throw new TransitError('UNSUPPORTED','현재 대전 시내 경로만 지원해요.',422);
 if(!data.result||!Array.isArray(data.result.path))throw new TransitError('INVALID_RESPONSE','교통 정보 응답을 확인하지 못했어요.');
 if(data.result.path.some(p=>!Array.isArray(p.subPath)||p.subPath.some(s=>![1,2,3].includes(s.trafficType))))throw new TransitError('INVALID_RESPONSE','이동 수단 정보를 확인하지 못했어요.');
 return data.result.path.slice(0,6).map((p,i)=>({id:String(i),minutes:num(p.info?.totalTime),walkDistance:num(p.info?.totalWalk),fare:num(p.info?.payment),mapObj:p.info?.mapObj||null,legs:(p.subPath||[]).map(s=>({mode:s.trafficType===1?'subway':s.trafficType===2?'bus':'walk',minutes:num(s.sectionTime),distance:num(s.distance),start:s.startName||null,end:s.endName||null,line:(s.lane||[]).map(l=>l.busNo||l.name||'').filter(Boolean).join(' / '),direction:s.way||null,stops:num(s.stationCount),from:num(s.startX)!==null&&num(s.startY)!==null?[num(s.startX),num(s.startY)]:null,to:num(s.endX)!==null&&num(s.endY)!==null?[num(s.endX),num(s.endY)]:null,accessibility:'unknown'}))}));
}
// A judging session hits the same handful of routes over and over, and every miss spends one of a
// finite daily allowance. Answers are held in memory only: keyed by rounded coordinates, dropped on
// expiry, never written anywhere. Line geometry is fixed for a given descriptor, so it keeps longer
// than a route plan does.
const ROUTE_TTL=10*60*1000,GEOMETRY_TTL=24*60*60*1000,CACHE_LIMIT=300;
const cache=new Map();
export function cacheStats(){return {size:cache.size};}
function cached(key,ttl,produce){
 const hit=cache.get(key);
 if(hit&&hit.expires>Date.now())return hit.value;
 if(hit)cache.delete(key);
 const value=produce();
 // Hold the promise so simultaneous callers share one upstream call, and forget it if it rejects.
 cache.set(key,{value,expires:Date.now()+ttl});
 value.catch?.(()=>{if(cache.get(key)?.value===value)cache.delete(key);});
 if(cache.size>CACHE_LIMIT)cache.delete(cache.keys().next().value);
 return value;
}
const at=p=>p.map(v=>v.toFixed(5)).join(',');

export async function handleTransit(request,env={},fetcher=fetch){
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
 const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
 const url=new URL(request.url);
 if(url.pathname==='/api/transit/status')return respond({configured:!!env.ODSAY_API_KEY});
 if(request.method!=='POST')return respond({error:'POST 요청만 지원해요.'},405);
 if(!env.ODSAY_API_KEY)return respond({code:'NOT_CONFIGURED',error:'대중교통 정보를 연결 준비 중이에요. 현재 보행 경로를 이용할 수 있어요.'},503);
 try{
  const raw=await request.text();if(raw.length>4096)throw new TransitError('INVALID_REQUEST','요청이 너무 커요.',413);
  let body;try{body=JSON.parse(raw);}catch{throw new TransitError('INVALID_REQUEST','요청 형식이 올바르지 않아요.',400);}
  const call=async(endpoint,params)=>{const u=new URL('https://api.odsay.com/v1/api/'+endpoint);for(const [k,v] of Object.entries({...params,apiKey:env.ODSAY_API_KEY,output:'json'}))u.searchParams.set(k,String(v));const serviceUri=env.ODSAY_SERVICE_URI||'galsuissyu-map.superstarrypassion.chatgpt.site';const serviceOrigin='https://'+serviceUri.replace(/^https?:\/\//,'').replace(/\/$/,'');const r=await fetcher(u,{headers:{Referer:serviceOrigin+'/',Origin:serviceOrigin},signal:AbortSignal.timeout(18000)});if(!r.ok)throw new TransitError('UPSTREAM','교통 정보를 잠시 불러오지 못했어요.');return r.json();};
  if(url.pathname==='/api/transit/routes'){
   if(!coord(body.from)||!coord(body.to)||!['all','bus','subway'].includes(body.mode))throw new TransitError('INVALID_REQUEST','대전 안의 출발·도착 위치와 이동 수단을 선택해 주세요.',400);
   if(body.from.every((v,i)=>v===body.to[i]))throw new TransitError('SAME_POINT','출발지와 도착지를 다르게 선택해 주세요.',400);
   const key=`routes:${at(body.from)}:${at(body.to)}:${body.mode}`;
   const data=await cached(key,ROUTE_TTL,()=>call('searchPubTransPathT',{SX:body.from[0],SY:body.from[1],EX:body.to[0],EY:body.to[1],SearchType:0,SearchPathType:{all:0,subway:1,bus:2}[body.mode]}));
   // normalizePaths throws for provider-side failures, so do it outside the cache: a quota answer
   // must not be remembered as if it were this route's result.
   let routes;try{routes=normalizePaths(data);}catch(e){cache.delete(key);throw e;}
   return respond({routes,source:'ODsay',checkedAt:new Date().toISOString()});
  }
  if(url.pathname==='/api/transit/geometry'){
   if(typeof body.mapObj!=='string'||body.mapObj.length>2500||!/^[0-9:.@-]+$/.test(body.mapObj))throw new TransitError('INVALID_REQUEST','노선 정보가 올바르지 않아요.',400);
   // Prefix the provider's complete lane descriptor with an absolute-coordinate base.
   // A valid one-section mapObj contains no @, so do not discard its first section.
   const key='geometry:'+body.mapObj;
   const data=await cached(key,GEOMETRY_TTL,()=>call('loadLane',{mapObject:'0:0@'+body.mapObj}));
   if(data.error){cache.delete(key);throw new TransitError('GEOMETRY','노선 선형을 불러오지 못했어요. 구간 안내는 계속 볼 수 있어요.');}
   const features=(data.result?.lane||[]).flatMap((l,order)=>(l.section||[]).map((s,section)=>({type:'Feature',properties:{mode:l.class===2?'subway':'bus',order,section},geometry:{type:'LineString',coordinates:(s.graphPos||[]).map(p=>[num(p.x),num(p.y)]).filter(p=>p.every(v=>v!==null)&&p[0]>124&&p[0]<132&&p[1]>33&&p[1]<39)}}))).filter(f=>f.geometry.coordinates.length>=2);
   if(!features.length)throw new TransitError('GEOMETRY','노선 좌표를 확인하지 못했어요.');return respond({type:'FeatureCollection',features});
  }
  return respond({error:'없는 기능이에요.'},404);
 }catch(e){return respond({code:e instanceof TransitError?e.code:'UNAVAILABLE',error:e instanceof TransitError?e.message:'교통 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'},e instanceof TransitError?e.status:502);}
}
