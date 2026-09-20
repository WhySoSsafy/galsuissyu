// Snapshots the Korea Tourism Organization's Daejeon records into public/data/tour-places.json.
//
// The list call gives names, coordinates and photos; the per-item intro call is the only place the
// operating hours, parking and stroller notes live, so every record needs both. Daejeon is 231
// records, which is small enough to take in full at build time and leaves the daily quota for the
// live lookups the app makes when someone opens a place.
//
// Usage: TOUR_API_KEY=... node scripts/fetch-tour-places.mjs
import {writeFile,mkdir} from 'node:fs/promises';
import {loadEnv} from 'vite';

const env={...loadEnv('development',process.cwd(),''),...process.env};
const KEY=env.TOUR_API_KEY;
if(!KEY){console.error('TOUR_API_KEY가 없어요. .env.local에 설정해 주세요.');process.exit(1);}

const BASE='https://apis.data.go.kr/B551011/KorService2';
const BARRIER_FREE_BASE='https://apis.data.go.kr/B551011/KorWithService2';
const AREA_DAEJEON='3';
// 12 관광지 · 14 문화시설 · 15 축제공연행사 · 28 레포츠 · 32 숙박 · 38 쇼핑 · 39 음식점
const TYPES=['12','14','15','28','32','38','39'];
const TYPE_LABELS={12:'관광지',14:'문화시설',15:'축제·공연',28:'레포츠',32:'숙박',38:'쇼핑',39:'음식점'};

async function call(operation,params,base=BASE){
 const url=new URL(base+'/'+operation);
 url.searchParams.set('serviceKey',KEY);
 url.searchParams.set('MobileOS','ETC');
 url.searchParams.set('MobileApp','galsuissyu');
 url.searchParams.set('_type','json');
 for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));
 const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
 const text=await response.text();
 let data;
 try{data=JSON.parse(text);}catch{throw Error(operation+' 응답이 JSON이 아니에요: '+text.slice(0,160));}
 // The portal reports auth and quota failures in a different envelope than the service itself.
 if(data.OpenAPI_ServiceResponse){
  const header=data.OpenAPI_ServiceResponse.cmmMsgHeader??{};
  // The per-second cap is the portal pacing us, not a bad request: wait and let the caller retry.
  if(header.returnReasonCode==='23')throw Object.assign(Error('요청 제한'),{retryable:true});
  throw Error(operation+' 거부: '+header.returnAuthMsg);
 }
 if(data.resultCode&&data.resultCode!=='0000')throw Error(operation+' 오류 '+data.resultCode+': '+data.resultMsg);
 const header=data.response?.header;
 if(header&&header.resultCode!=='0000')throw Error(operation+' 오류 '+header.resultCode+': '+header.resultMsg);
 return data.response?.body??{};
}

const rows=x=>x?[].concat(x.items?.item??[]):[];

// The portal caps requests per second and reports the overrun as an auth-shaped error, so treat
// that one code as pacing and try again instead of losing the record.
async function callWithBackoff(operation,params,base){
 for(let attempt=0;;attempt++){
  try{return await call(operation,params,base);}
  catch(error){
   if(!error.retryable||attempt>=5)throw error;
   await new Promise(r=>setTimeout(r,400*(attempt+1)));
  }
 }
}

async function listAll(params,base){
 const collected=[];
 for(let page=1;;page++){
  const body=await callWithBackoff('areaBasedList2',{areaCode:AREA_DAEJEON,numOfRows:100,pageNo:page,...params},base);
  const items=rows(body);
  collected.push(...items);
  if(collected.length>=Number(body.totalCount||0)||!items.length)break;
 }
 return collected;
}
const listType=contentTypeId=>listAll({contentTypeId});

// Only the fields we can actually show. Everything else is left out rather than stored "just in case".
function intro(item,contentTypeId){
 const pick=(...names)=>{for(const n of names){const v=item?.[n];if(typeof v==='string'&&v.trim())return v.trim();}return '';};
 return {
  hours:pick('usetime','opentimefood','usetimeculture','opentime'),
  restDay:pick('restdate','restdatefood','restdateculture','restdateshopping'),
  parking:pick('parking','parkingfood','parkingculture','parkingshopping','parkinglodging','parkingleports'),
  // TourAPI documents chkbabycarriage as 유모차대여여부, but providers fill it with both rental and
  // access wording ("없음", "불가", "가능"). Keep the original words and let the UI attribute them
  // rather than deciding here what the provider meant.
  strollerNote:pick('chkbabycarriage','chkbabycarriageculture','chkbabycarriageshopping','chkbabycarriageleports'),
  petNote:pick('chkpet','chkpetculture','chkpetshopping','chkpetleports'),
  phone:pick('infocenter','infocenterfood','infocenterculture','infocentershopping','infocenterleports','infocenterlodging'),
  ageRange:pick('expagerange'),
  contentTypeId,
 };
}

// detailInfo2 carries a handful of extras the intro call does not: admission price, whether there is
// a toilet, parking charges. Kept as the provider's own name and wording rather than squeezed into
// fields of our own, because the set varies by place.
function extras(items){
 const rows=items.map(i=>({name:String(i.infoname||'').replace(/\s+/g,' ').trim(),text:String(i.infotext||'').replace(/<br\s*\/?>/gi,' ').replace(/\s+/g,' ').trim()}))
  .filter(r=>r.name&&r.text);
 return rows.length?rows.slice(0,8):null;
}

// KorWithService2 returns one flat record per place. Group it the way a traveller asks the
// question -- can I get in, can I get around, can I read it, can I hear it, can I bring the baby --
// and keep the provider's own wording inside each field.
const clean=v=>typeof v==='string'?v.replace(/<br\s*\/?>/gi,'\n').replace(/&nbsp;/g,' ').trim():'';
const anyOf=obj=>Object.values(obj).some(Boolean)?obj:null;
function barrierFree(item){
 if(!item)return null;
 const f=name=>clean(item[name]);
 return {
  getIn:anyOf({entrance:f('exit'),parking:f('parking'),publicTransport:f('publictransport'),ticketOffice:f('ticketoffice')}),
  moveAround:anyOf({route:f('route'),elevator:f('elevator'),restroom:f('restroom'),wheelchair:f('wheelchair'),auditorium:f('auditorium'),room:f('room'),note:f('handicapetc')}),
  vision:anyOf({brailleBlock:f('braileblock'),guideDog:f('helpdog'),audioGuide:f('audioguide'),bigPrint:f('bigprint'),braillePromotion:f('brailepromotion'),guideSystem:f('guidesystem'),humanGuide:f('guidehuman'),note:f('blindhandicapetc')}),
  hearing:anyOf({signGuide:f('signguide'),videoGuide:f('videoguide'),hearingRoom:f('hearingroom'),note:f('hearinghandicapetc')}),
  family:anyOf({stroller:f('stroller'),lactationRoom:f('lactationroom'),babyChair:f('babysparechair'),note:f('infantsfamilyetc')}),
 };
}

const limit=async(items,size,worker)=>{
 const out=[];let index=0;
 await Promise.all(Array.from({length:size},async()=>{
  while(index<items.length){const i=index++;out[i]=await worker(items[i],i);}
 }));
 return out;
};

const listed=[];
for(const type of TYPES){
 const items=await listType(type);
 console.log(`${TYPE_LABELS[type]}(${type}): ${items.length}건`);
 listed.push(...items.map(item=>({item,type})));
}

// The barrier-free service lists a different slice of the same catalogue, so anything it knows that
// the general list missed is added rather than dropped.
const accessible=await listAll({},BARRIER_FREE_BASE);
const known=new Set(listed.map(x=>String(x.item.contentid)));
const extra=accessible.filter(item=>!known.has(String(item.contentid)));
listed.push(...extra.map(item=>({item,type:String(item.contenttypeid)})));
const accessibleIds=new Set(accessible.map(item=>String(item.contentid)));
console.log(`무장애 여행정보: ${accessible.length}건 (일반 목록에 없던 ${extra.length}건 추가)`);

console.log(`상세 정보를 받는 중… ${listed.length}건`);
let done=0,failed=0,accessFailed=0;
const places=await limit(listed,2,async({item,type})=>{
 // The portal caps requests per second, so back off and try again rather than dropping the record.
 let detail=null;
 for(let attempt=0;attempt<6&&!detail;attempt++){
  try{detail=intro(rows(await call('detailIntro2',{contentId:item.contentid,contentTypeId:type}))[0],type);}
  catch(error){
   if(!error.retryable)break;
   await new Promise(r=>setTimeout(r,400*(attempt+1)));
  }
 }
 if(!detail){failed++;detail=intro(null,type);}
 let detailExtras=null;
 try{detailExtras=extras(rows(await callWithBackoff('detailInfo2',{contentId:item.contentid,contentTypeId:type})));}catch{}
 let access=null;
 if(accessibleIds.has(String(item.contentid))){
  try{access=barrierFree(rows(await callWithBackoff('detailWithTour2',{contentId:item.contentid},BARRIER_FREE_BASE))[0]);}
  catch{accessFailed++;}
 }
 if(++done%40===0)console.log(`  ${done}/${listed.length}`);
 const lon=Number(item.mapx),lat=Number(item.mapy);
 return {
  contentId:String(item.contentid),
  name:item.title,
  category:TYPE_LABELS[type],
  contentTypeId:type,
  address:[item.addr1,item.addr2].filter(Boolean).join(' ').trim(),
  lon:Number.isFinite(lon)&&lon!==0?lon:null,
  lat:Number.isFinite(lat)&&lat!==0?lat:null,
  image:item.firstimage||'',
  thumbnail:item.firstimage2||'',
  tel:item.tel||'',
  modifiedAt:String(item.modifiedtime||''),
  ...detail,
  extras:detailExtras,
  barrierFree:access,
 };
});

const withCoordinates=places.filter(p=>p.lon!==null&&p.lat!==null);
const documented=places.filter(p=>p.barrierFree&&Object.values(p.barrierFree).some(Boolean));
const snapshot={
 source:'한국관광공사 TourAPI 4.0 · 공공데이터포털',
 services:['KorService2 (국문 관광정보)','KorWithService2 (무장애 여행정보)'],
 license:'출처 표시 조건 하에 이용',
 areaCode:AREA_DAEJEON,
 collectedAt:new Date().toISOString().slice(0,10),
 counts:{
  total:places.length,
  withCoordinates:withCoordinates.length,
  withHours:places.filter(p=>p.hours).length,
  withParking:places.filter(p=>p.parking).length,
  strollerNoted:places.filter(p=>p.strollerNote).length,
  barrierFree:documented.length,
  barrierFreeGetIn:places.filter(p=>p.barrierFree?.getIn).length,
  barrierFreeMoveAround:places.filter(p=>p.barrierFree?.moveAround).length,
  barrierFreeVision:places.filter(p=>p.barrierFree?.vision).length,
  barrierFreeHearing:places.filter(p=>p.barrierFree?.hearing).length,
  barrierFreeFamily:places.filter(p=>p.barrierFree?.family).length,
  withExtras:places.filter(p=>p.extras).length,
 },
 places:places.sort((a,b)=>a.name.localeCompare(b.name,'ko')),
};

await mkdir('public/data',{recursive:true});
await writeFile('public/data/tour-places.json',JSON.stringify(snapshot));
console.log('\n저장: public/data/tour-places.json');
console.log(JSON.stringify(snapshot.counts,null,1));
if(failed)console.log(`상세를 받지 못한 항목 ${failed}건은 빈 값으로 남겼어요.`);
if(accessFailed)console.log(`무장애 상세를 받지 못한 항목 ${accessFailed}건은 미확인으로 남겼어요.`);
