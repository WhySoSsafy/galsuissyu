import type {CityPlace} from './city-data';

// Shapes written by scripts/fetch-tour-places.mjs from the Korea Tourism Organization's TourAPI.
// Every string here is the provider's own wording; nothing is rewritten into a verdict.
export type BarrierFreeSection=Record<string,string>|null;
export type BarrierFree={getIn:BarrierFreeSection;moveAround:BarrierFreeSection;vision:BarrierFreeSection;hearing:BarrierFreeSection;family:BarrierFreeSection};
export type TourExtra={name:string;text:string};
export type TourPlace={contentId:string;name:string;category:string;contentTypeId:string;address:string;lon:number|null;lat:number|null;image:string;thumbnail:string;tel:string;modifiedAt:string;hours:string;restDay:string;parking:string;strollerNote:string;petNote:string;phone:string;ageRange:string;extras:TourExtra[]|null;barrierFree:BarrierFree|null};
export type TourSnapshot={source:string;services:string[];license:string;areaCode:string;collectedAt:string;counts:Record<string,number>;places:TourPlace[]};

// Who a trip has to work for. The barrier-free record answers these in separate blocks, so a group
// maps to the blocks a companion actually needs rather than to a diagnosis.
export type Companion='senior'|'stroller'|'wheelchair'|'vision'|'hearing';
// `image` names a file under /assets/survey/. A missing one is hidden by the card rather than
// left as a broken frame, so the step still works before every illustration exists.
export const companions:{key:Companion;label:string;help:string;image:string;sections:(keyof BarrierFree)[]}[]=[
 {key:'senior',label:'어르신과 함께',help:'계단·경사와 쉴 곳을 먼저 봐요.',image:'rest',sections:['getIn','moveAround']},
 {key:'stroller',label:'유아차와 함께',help:'출입 통로와 수유실을 봐요.',image:'stroller',sections:['getIn','family']},
 {key:'wheelchair',label:'휠체어로 이동',help:'출입구·승강기·화장실을 봐요.',image:'wheelchair',sections:['getIn','moveAround']},
 {key:'vision',label:'시각 안내가 필요해요',help:'점자블록과 음성 안내를 봐요.',image:'vision',sections:['vision']},
 {key:'hearing',label:'청각 안내가 필요해요',help:'수어·영상 안내를 봐요.',image:'hearing',sections:['hearing']},
];

export const sectionLabels:Record<keyof BarrierFree,string>={getIn:'도착과 출입',moveAround:'내부 이동',vision:'시각 안내',hearing:'청각 안내',family:'영유아 동반'};
export const fieldLabels:Record<string,string>={
 entrance:'출입구',parking:'주차',publicTransport:'대중교통',ticketOffice:'매표소',
 route:'내부 통로',elevator:'승강기',restroom:'화장실',wheelchair:'휠체어 대여',auditorium:'관람석',room:'객실',
 brailleBlock:'점자블록',guideDog:'안내견',audioGuide:'음성 안내',bigPrint:'큰 글씨 안내',braillePromotion:'점자 안내물',guideSystem:'안내 시스템',humanGuide:'안내 도우미',
 signGuide:'수어 안내',videoGuide:'영상 안내',hearingRoom:'청각 보조 설비',
 stroller:'유아차 대여',lactationRoom:'수유실',babyChair:'유아용 의자',
 note:'기타 안내',
};

// A KTO content type maps onto the categories the map already draws with.
const CATEGORY:Record<string,string>={'12':'attraction','14':'culture','15':'culture','28':'attraction','32':'public','38':'shopping','39':'food'};

// The Tourism Organization records nearby transit as free text, e.g.
// "대중교통 이용가능 : 스마트뷰아파트 정류장\n저상버스 운행 : 201, 501, 611, 615, 701번".
// Only the numbers on a line that actually says 저상 are low-floor routes; the other lines list
// ordinary buses, and treating those as accessible would be inventing the fact.
export function lowFloorBuses(place:TourPlace):string[]{
 const text=place.barrierFree?.getIn?.publicTransport;
 if(!text)return [];
 const found=new Set<string>();
 for(const line of text.split('\n')){
  if(!/저상/.test(line))continue;
  for(const m of line.matchAll(/\d{1,4}(?:-\d)?/g))found.add(m[0]);
 }
 return [...found];
}

export function entries(section:BarrierFreeSection){
 return section?Object.entries(section).filter(([,v])=>v):[];
}

export function hasAnyFor(place:TourPlace,list:Companion[]){
 if(!place.barrierFree)return false;
 const wanted=list.length?list:companions.map(c=>c.key);
 return companions.filter(c=>wanted.includes(c.key)).some(c=>c.sections.some(s=>entries(place.barrierFree![s]).length>0));
}

// Turns a Tourism Organization record into the place shape the map and route panel already use.
// wheelchair stays 'unknown' unless the provider actually describes step-free entry: the barrier-free
// text is an accessibility description, not a yes/no field, so reading a verdict out of it would be
// inventing one.
const secure=(url:string)=>url?url.replace(/^http:\/\//,'https://'):undefined;

export function toCityPlace(p:TourPlace):CityPlace|null{
 if(p.lon===null||p.lat===null)return null;
 const access=p.barrierFree;
 const notes:string[]=[];
 if(access)for(const key of Object.keys(sectionLabels) as (keyof BarrierFree)[]){
  for(const [field,value] of entries(access[key]))notes.push(`${sectionLabels[key]} · ${fieldLabels[field]??field}: ${value.replace(/\n/g,' ')}`);
 }
 if(p.strollerNote)notes.push(`유아차 안내 원문: ${p.strollerNote}`);
 return {
  id:'kto-'+p.contentId,
  name:p.name,
  category:CATEGORY[p.contentTypeId]??'public',
  lon:p.lon,lat:p.lat,
  wheelchair:'unknown',toiletWheelchair:'unknown',access:'unknown',
  hours:[p.hours,p.restDay&&'휴무 '+p.restDay].filter(Boolean).join(' · '),
  phone:p.phone||p.tel,
  website:'',
  source:'https://api.visitkorea.or.kr/#/detail?contentid='+p.contentId,
  address:p.address,
  checkedAt:p.modifiedAt.slice(0,8).replace(/(\d{4})(\d{2})(\d{2})/,'$1-$2-$3'),
  facilities:[],
  verified:!!access,
  accessNotes:notes,
  // The provider hands these out over http; a page served over https would refuse to load them.
  image:secure(p.image||p.thumbnail),
  thumbnail:secure(p.thumbnail||p.image),
 };
}
