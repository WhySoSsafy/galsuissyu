import {useEffect,useMemo,useRef,useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {DaejeonMap} from './DaejeonMap';
import type {CityViewHandle} from './CityFallback';
import {accessCoverage,categories,districtCenters,distance,formatDistance,accessLabel,insideCity,placeCoordinate,type CityData,type CityPlace,type Coordinate,type Mobility} from './city-data';
import type {RouteResult} from './route-engine';
import {places as trustedPlaces} from './places';
import {companions,toCityPlace,type Companion,type TourPlace,type TourSnapshot} from './tour-data';
import {TourAccess} from './TourAccess';
import './city-explorer.css';
import './mobile-map.css';
import './experience.css';
import {MobilitySurvey} from './MobilitySurvey';
import type {TransitSimulation} from './transit-types';
import {TransitOptions} from './TransitOptions';
import {JourneyPlayer} from './JourneyPlayer';
import {TransitJourneyPlayer} from './TransitJourneyPlayer';
import {JourneyArrival} from './JourneyArrival';
import {transitSimulationGeoJSON} from './transit-simulation';
import {hanbitLocation} from './city-landmarks';
import {enrichPilotPlaces,getPilotPlace,pilotAssetForPlace,pilotStops,type PilotAssetId} from './pilot-data';
import type {PilotLoadState} from './pilot-models';
import {AccessDetails,RouteDetails,TravelDestinations} from './TravelDetails';

const initialPrefs:Mobility={wheelchair:true,steps:true,rough:false,steep:true,rest:false};
const preferenceLabels:[keyof Mobility,string,string][]=[['wheelchair','휠체어·유아차 이용','휠체어 불가로 기록된 길 제외'],['steps','계단 피하기','계단으로 기록된 구간 제외'],['steep','가파른 경사 피하기','기록된 경사 5% 초과 구간 제외'],['rough','거친 노면 피하기','자갈·흙·모래 등으로 기록된 길 제외'],['rest','휴식 장소 함께 보기','도착지 주변 공원·쉼터 정보 표시']];
const normalize=(v:string)=>v.replace(/\s/g,'').toLowerCase();
// Folds the Tourism Organization's Daejeon records into the map's own place list. An OSM entry with
// the same name within 150m is the same door, so the richer record wins; everything else is added.
function includeTourPlaces(data:CityData,tour:TourPlace[]):CityData{
 const added=tour.map(toCityPlace).filter((p):p is CityPlace=>!!p);
 if(!added.length)return data;
 const district=(p:CityPlace)=>data.districts.find(d=>insideCity([p.lon,p.lat],d.geometry))?.name;
 for(const p of added)p.district=district(p);
 const kept=data.places.filter(p=>!added.some(a=>normalize(a.name)===normalize(p.name)&&distance([a.lon,a.lat],[p.lon,p.lat])<150));
 return {...data,places:[...added,...kept]};
}

function includeTrusted(data:CityData){const all=data.places.filter(p=>!trustedPlaces.some(t=>normalize(p.name)===normalize(t.name)));for(const p of trustedPlaces){all.unshift({id:'kto-'+p.id,name:p.name,category:p.id==='museum'?'culture':'park',lat:p.lat,lon:p.lon,district:'서구',wheelchair:'unknown',toiletWheelchair:'unknown',access:'unknown',hours:p.hours,phone:p.phone,website:'',source:p.source,address:'',checkedAt:'2026-09-13',facilities:[...p.facility],verified:true,accessNotes:[...p.access,p.unknown],image:p.image});}all.push({id:'landmark-hanbit',name:'한빛탑',category:'attraction',lon:hanbitLocation[0],lat:hanbitLocation[1],district:'유성구',wheelchair:'unknown',toiletWheelchair:'unknown',access:'unknown',hours:'',phone:'',website:'',source:'https://www.djto.kr/kor/page.do?menuIdx=652',address:'',checkedAt:'2026-09-16',facilities:[],verified:false,accessNotes:['대전관광공사에서 안내하는 높이 93m의 한빛탑입니다.','지도 위치는 OSM 건물 외곽선 기준이며 모형의 세부 형태는 재구성했습니다.','출입구 접근성과 승강기 당일 운영은 방문 전 확인해 주세요.']});return enrichPilotPlaces({...data,places:all});}
export default function CityExplorer({onLegacy,onPilotAssets,initialPilot,onStationExperience}:{onLegacy:()=>void;onPilotAssets:(asset?:PilotAssetId)=>void;initialPilot?:PilotAssetId;onStationExperience:()=>void}){
 const [transitGeometry,setTransitGeometry]=useState<GeoJSON.FeatureCollection<GeoJSON.LineString>|null>(null),[transitSimulation,setTransitSimulation]=useState<TransitSimulation|null>(null),[transitPreview,setTransitPreview]=useState(false),[transitProgress,setTransitProgress]=useState(0),[travelMode,setTravelMode]=useState<'walk'|'transit'>('walk');
 const [pilotState,setPilotState]=useState<PilotLoadState>({ready:0,loading:0,failed:0});
 const initialPilotDone=useRef(false),mobileSearch=useRef<HTMLInputElement>(null),panelScroll=useRef<HTMLDivElement>(null);
 const [mobileMode,setMobileMode]=useState<'browse'|'search'|'route'|'place'>('browse');
 const [terrainStrength,setTerrainStrength]=useState(()=>{try{const n=Number(localStorage.getItem('galsu-terrain-strength')??1.5);return [0,1,1.5,2].includes(n)?n:1.5;}catch{return 1.5;}});
 useEffect(()=>{try{localStorage.setItem('galsu-terrain-strength',String(terrainStrength));}catch{}},[terrainStrength]);
 const [mapMenu,setMapMenu]=useState(false);
 const [panelOpen,setPanelOpen]=useState(true),[progress,setProgress]=useState(0),[speed,setSpeed]=useState(1),[follow,setFollow]=useState(false);
 const [sheetLevel,setSheetLevel]=useState<'peek'|'half'|'full'>('peek');
 const sheet=sheetLevel==='full';
 const setSheet=(expanded:boolean)=>setSheetLevel(expanded?'full':'peek');

 const view=useRef<CityViewHandle>(null),search=useRef<HTMLInputElement>(null),worker=useRef<Worker|null>(null),request=useRef(0);
 const walkRequest=useRef(0);
 const pending=useRef(new Map<string,(paths:(Coordinate[]|null)[]|null)=>void>());
 const [data,setData]=useState<CityData|null>(null),[tour,setTour]=useState<TourSnapshot|null>(null),[dataError,setDataError]=useState(false),[query,setQuery]=useState(''),[category,setCategory]=useState('all'),[district,setDistrict]=useState('전체'),[limit,setLimit]=useState(24);
 const [selected,setSelected]=useState<CityPlace|null>(null),[from,setFrom]=useState<CityPlace|null>(null),[to,setTo]=useState<CityPlace|null>(null),[picking,setPicking]=useState<'from'|'to'|null>(null),[prefs,setPrefs]=useState<Mobility>(initialPrefs);
 const [survey,setSurvey]=useState(false),[route,setRoute]=useState<RouteResult|null>(null),[routing,setRouting]=useState(false),[routeError,setRouteError]=useState(''),[detailCount,setDetailCount]=useState(0),[zoom,setZoom]=useState(16.6),[compat,setCompat]=useState(false),[notice,setNotice]=useState(''),[preview,setPreview]=useState(false),[chipsOpen,setChipsOpen]=useState(false),[startedSimulation,setStartedSimulation]=useState<unknown>(null),[wantSurvey,setWantSurvey]=useState(false),[autoRun,setAutoRun]=useState(0),[companion,setCompanion]=useState<Companion[]>([]),[panelMode,setPanelMode]=useState<'search'|'route'>('search');
 useEffect(()=>{let stopped=false;
 Promise.all([
  fetch('/data/places.json').then(r=>{if(!r.ok)throw Error();return r.json();}),
  // The Tourism Organization snapshot is a bonus layer: if it fails the map still opens on OSM data.
  fetch('/data/tour-places.json').then(r=>r.ok?r.json():null).catch(()=>null),
 ]).then(([city,snapshot]:[CityData,TourSnapshot|null])=>{
  if(stopped)return;
  setTour(snapshot);
  setData(includeTrusted(snapshot?includeTourPlaces(city,snapshot.places):city));
 }).catch(()=>setDataError(true));try{const stored=localStorage.getItem('galsuissyu-city-prefs');if(stored){const parsed=JSON.parse(stored);const values=parsed?.version===1?parsed.values:parsed;const safe={...initialPrefs};for(const key of Object.keys(safe) as (keyof Mobility)[])if(typeof values?.[key]==='boolean')safe[key]=values[key];setPrefs(safe);const saved=parsed?.companion;if(Array.isArray(saved))setCompanion(saved.filter((k:string)=>companions.some(c=>c.key===k)));}else setWantSurvey(true);}catch{}return()=>{stopped=true;};},[]);
 useEffect(()=>{worker.current=new Worker(new URL('./route.worker.ts',import.meta.url),{type:'module'});worker.current.onmessage=e=>{
  // Walk-leg jobs carry their own ids and are answered through the map of waiting resolvers.
  const waiting=pending.current.get(e.data.id);
  if(waiting){pending.current.delete(e.data.id);waiting(e.data.paths??null);return;}
  if(e.data.id!==request.current)return;setRouting(false);if(e.data.error){setRouteError(e.data.error);return;}setRoute(e.data.result);setMobileMode('route');setSheetLevel('half');view.current?.fitRoute(e.data.result.coordinates);};worker.current.onerror=()=>{setRouting(false);setRouteError('경로를 계산하지 못했어요. 다시 시도해 주세요.');};return()=>worker.current?.terminate();},[]);
 useEffect(()=>{panelScroll.current?.scrollTo({top:0});},[mobileMode,selected?.id]);
 useEffect(()=>{request.current++;setRoute(null);setRouteError('');setRouting(false);},[from?.id,to?.id,prefs]);
 useEffect(()=>{setPreview(false);setProgress(0);setFollow(false);},[route]);
 useEffect(()=>{if(!preview||!route)return;let frame=0,last=performance.now();const duration=Math.max(30,Math.min(150,route.minutes*3));const tick=(now:number)=>{if(now-last>=50){const dt=document.hidden?0:Math.min(100,now-last);last=now;setProgress(p=>Math.min(1,p+dt/1000*speed/duration));}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[preview,route,speed]);
 useEffect(()=>{if(progress>=1)setPreview(false);},[progress]);
 useEffect(()=>{if(!transitPreview||!transitSimulation)return;let frame=0,last=performance.now();const duration=Math.max(35,Math.min(170,transitSimulation.totalMinutes*2.8));const tick=(now:number)=>{if(now-last>=50){const dt=document.hidden?0:Math.min(100,now-last);last=now;setTransitProgress(p=>Math.min(1,p+dt/1000*speed/duration));}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[transitPreview,transitSimulation,speed]);
 useEffect(()=>{if(transitProgress>=1)setTransitPreview(false);},[transitProgress]);
 // Map chrome steps aside for the whole run, not just while the frames are advancing: we remember
 // which simulation the viewer started rather than watching progress, so pausing (even at 0%, where
 // a backgrounded tab leaves it) keeps the chrome away instead of flashing the chips back in.
 const activeSimulation=transitSimulation??route;
 useEffect(()=>{if(preview||transitPreview)setStartedSimulation(activeSimulation);},[preview,transitPreview,activeSimulation]);
 const simulationEngaged=!!activeSimulation&&startedSimulation===activeSimulation&&(transitSimulation?transitProgress<1:progress<1);
 useEffect(()=>{if(simulationEngaged)setChipsOpen(false);},[simulationEngaged]);
 const coverage=useMemo(()=>data?accessCoverage(data):null,[data]);
 const tourById=useMemo(()=>new Map((tour?.places??[]).map(p=>['kto-'+p.contentId,p])),[tour]);
 const selectedTour=selected?tourById.get(selected.id)??null:null;
 // Hold the first-visit survey until the places file lands, so its opening step can state real counts.
 useEffect(()=>{if(wantSurvey&&coverage){setSurvey(true);setWantSurvey(false);}},[wantSurvey,coverage]);
 // Whenever the app starts waiting for an endpoint, put the cursor in the box that takes it, so
 // setting one end leaves the other ready to type into.
 useEffect(()=>{if(picking)(window.innerWidth<=740?mobileSearch:search).current?.focus();},[picking]);
 useEffect(()=>{setLimit(24);},[district,query,category]);
 useEffect(()=>{if(!notice)return;const id=setTimeout(()=>setNotice(''),4500);return()=>clearTimeout(id);},[notice]);
 const filtered=useMemo(()=>{const q=normalize(query);return (data?.places??[]).filter(p=>(district==='전체'||p.district===district)&&(category==='all'||p.category===category||(category==='elevator'&&p.facilities.includes('elevator'))||(category==='toilet'&&p.facilities.includes('toilet')))&&(!q||normalize(p.name+' '+p.district+' '+p.address).includes(q))).sort((a,b)=>{const score=(p:CityPlace)=>(p.verified?100:0)+(/^(한빛탑|대전역|대청댐|대전오월드|뿌리공원|유림공원|우암사적공원|동춘당공원|엑스포과학공원)$/.test(p.name)?50:0)+(['attraction','culture','park'].includes(p.category)?5:0);return score(b)-score(a)||a.name.localeCompare(b.name,'ko');});},[data,query,district,category]);
 const mapPlaces=useMemo(()=>{const priority=[...(selected?[selected]:[]),...filtered.filter(p=>pilotStops.some(s=>s.id===p.id))];return [...priority,...filtered.filter(p=>!priority.some(x=>x.id===p.id))];},[filtered,selected]);
 useEffect(()=>{if(!data||initialPilotDone.current)return;const asset=initialPilot||(new URLSearchParams(location.search).has('pilot')?'station':undefined);if(!asset)return;initialPilotDone.current=true;const stop=pilotStops.find(s=>s.asset===asset);const p=stop&&getPilotPlace(data,stop.id);if(p)choose(p);},[data,initialPilot]);
 const nearby=useMemo(()=>selected&&data?data.places.filter(p=>p.id!==selected.id&&(p.category==='toilet'||p.category==='elevator'||(prefs.rest&&p.category==='park'))).map(p=>({p,m:distance(placeCoordinate(selected),placeCoordinate(p))})).filter(x=>x.m<700).sort((a,b)=>a.m-b.m).slice(0,4):[],[selected,data,prefs.rest]);
 // The detail card covers the left of the map, so the place is flown to the middle of what is still
// visible instead of to the middle of the map, where the card would sit on top of it.
const DETAIL_INSET=414;
function choose(p:CityPlace){setPreview(false);setFollow(false);setPanelOpen(true);setSelected(p);if(picking){if(picking==='from')setFrom(p);else setTo(p);setPicking(null);setQuery('');}view.current?.fly(placeCoordinate(p),pilotAssetForPlace(p.id)?16.8:17,window.innerWidth<=740?0:DETAIL_INSET);setMobileMode(picking?'route':'place');setSheetLevel(picking?'half':'peek');mobileSearch.current?.blur();}
 function point(c:Coordinate,force=false){if(!data)return;const d=data.districts.find(d=>insideCity(c,d.geometry));if(!d){setNotice('대전 안에서 출발·도착 지점을 선택해 주세요.');return;}choose({id:`pin-${c[0].toFixed(6)}-${c[1].toFixed(6)}`,name:'지도에서 선택한 위치',lon:c[0],lat:c[1],district:d.name,category:'public',wheelchair:'unknown',toiletWheelchair:'unknown',access:'unknown',hours:'',phone:'',website:'',source:'',address:'',checkedAt:data.collectedAt,facilities:[],verified:false});}
 function mapEndpoint(c:Coordinate,kind:'from'|'to'){if(!data)return;const district=data.districts.find(d=>insideCity(c,d.geometry));if(!district){setNotice('대전 안에서 위치를 선택해 주세요.');return;}const p:CityPlace={id:`pin-${c[0].toFixed(6)}-${c[1].toFixed(6)}`,name:'지도에서 선택한 '+(kind==='from'?'출발지':'도착지'),lon:c[0],lat:c[1],district:district.name,category:'public',wheelchair:'unknown',toiletWheelchair:'unknown',access:'unknown',hours:'',phone:'',website:'',source:'',address:'',checkedAt:data.collectedAt,facilities:[],verified:false};if(kind==='from')setFrom(p);else setTo(p);setPicking(null);setSelected(null);setPanelOpen(true);setMobileMode('route');setSheetLevel('half');setNotice((kind==='from'?'출발지':'도착지')+'로 설정했어요.');}
 // Reaching the transit simulation takes six deliberate steps, which is five too many for someone
 // meeting the app for the first time. This sets up the same journey and lets it play.
 function runDemo(){
  const origin=data?.places.find(p=>p.name==='대전역'),target=data?.places.find(p=>p.name==='한빛탑');
  if(!origin||!target){setNotice('둘러보기 경로를 준비하지 못했어요. 출발지와 도착지를 직접 골라 주세요.');return;}
  setSelected(null);setPicking(null);setQuery('');setChipsOpen(false);
  setFrom(origin);setTo(target);setRoute(null);setPreview(false);
  setTravelMode('transit');setPanelMode('route');setPanelOpen(true);setMobileMode('route');setSheetLevel('peek');
  setAutoRun(n=>n+1);
 }
 // Lends the walking network to the transit simulation so its walk legs follow real paths. Resolves
 // to null when the worker is unavailable, and the caller keeps its straight lines.
 function walkPaths(legs:{from:Coordinate;to:Coordinate}[]){
  return new Promise<(Coordinate[]|null)[]|null>(resolve=>{
   if(!worker.current||!legs.length)return resolve(null);
   const id='walk-'+(++walkRequest.current);
   const timer=setTimeout(()=>{if(pending.current.delete(id))resolve(null);},12000);
   pending.current.set(id,paths=>{clearTimeout(timer);resolve(paths);});
   worker.current.postMessage({id,legs,prefs});
  });
 }
 // Setting one end from a list row or the map card moves to 길찾기 and puts the cursor in the end
 // that is still empty, so the trip can be finished by typing rather than by hunting for a field.
 function setEndpoint(place:CityPlace,which:'from'|'to'){
  if(which==='from')setFrom(place);else setTo(place);
  const other=which==='from'?to:from;
  setPanelMode('route');setPanelOpen(true);setSelected(null);setPicking(other?null:(which==='from'?'to':'from'));
  setQuery('');setMobileMode('route');setSheetLevel('half');
  setNotice((which==='from'?'출발지':'도착지')+'로 설정했어요.');

 }
 // The 3D run is what this app has that a map app does not, so a place offers it beside 출발 and
 // 도착 rather than only from the corner of the map. From 대전역 unless the trip already has a start.
 function runSimulationTo(place:CityPlace){
  const origin=from&&from.id!==place.id?from:data?.places.find(p=>p.name==='대전역')??null;
  if(!origin){setNotice('출발지를 먼저 골라 주세요.');return;}
  setSelected(null);setPicking(null);setQuery('');setChipsOpen(false);
  setFrom(origin);setTo(place);setRoute(null);setPreview(false);
  setTravelMode('transit');setPanelMode('route');setPanelOpen(true);setMobileMode('route');setSheetLevel('peek');
  setAutoRun(n=>n+1);
 }
 function changeDistrict(name:string){setMobileMode('browse');setSheetLevel('peek');setMapMenu(false);setChipsOpen(false);setDistrict(name);setQuery('');setSelected(null);if(name==='전체')view.current?.overview();else view.current?.fly(districtCenters[name],14.3);}
 function beginEndpoint(which:'from'|'to'){setPanelOpen(true);setPicking(which);setSelected(null);setQuery('');setCategory('all');setDistrict('전체');setMobileMode('search');setSheet(true);(window.innerWidth<=740?mobileSearch:search).current?.focus();}
 function calculate(){setTransitGeometry(null);if(!from||!to){setRouteError('출발지와 도착지를 먼저 선택해 주세요.');return;}if(from.id===to.id){setRouteError('출발지와 도착지를 다르게 선택해 주세요.');return;}setRouting(true);setRoute(null);setRouteError('');const id=++request.current;worker.current?.postMessage({id,from:placeCoordinate(from),to:placeCoordinate(to),prefs});}
 function useTransitJourney(simulation:TransitSimulation|null){setTransitSimulation(simulation);setTransitGeometry(simulation?transitSimulationGeoJSON(simulation):null);setTransitProgress(0);setTransitPreview(!!simulation);if(simulation){setRoute(null);setPreview(false);setFollow(true);view.current?.fitRoute(simulation.coordinates);setMobileMode('route');setSheetLevel('peek');}else setTransitPreview(false);}
 function savePrefs(values:Mobility,group:Companion[]){setPrefs(values);setCompanion(group);try{localStorage.setItem('galsuissyu-city-prefs',JSON.stringify({version:1,values,companion:group}));}catch{}setSurvey(false);}
 function locate(){if(!navigator.geolocation){setNotice('현재 위치를 지원하지 않는 브라우저예요.');return;}navigator.geolocation.getCurrentPosition(p=>point([p.coords.longitude,p.coords.latitude],true),()=>setNotice('현재 위치를 가져오지 못했어요. 지도에서 직접 선택할 수 있어요.'),{timeout:10000,maximumAge:60000});}
 return <div className={'daejeon-app mobile-'+mobileMode+' sheet-'+sheetLevel+(panelOpen?'':' panel-collapsed')+(picking?' is-picking':'')}>
  <div className="dj-mobile-search"><button aria-label="검색 닫고 지도 보기" onClick={()=>{setMobileMode('browse');setSelected(null);setPicking(null);setQuery('');setSheet(false);mobileSearch.current?.blur();}}>‹</button><input ref={mobileSearch} aria-label="장소 또는 편의시설 검색" placeholder={picking?(picking==='from'?'출발지 검색':'도착지 검색'):'장소·주소·편의시설 검색'} value={query} onFocus={()=>{setSelected(null);setMobileMode('search');setSheet(true);}} onChange={e=>{setQuery(e.target.value);setSelected(null);setMobileMode('search');setSheet(true);}} onKeyDown={e=>{if(e.key==='Enter'){mobileSearch.current?.blur();setSheetLevel('half');}}}/>{query&&<button aria-label="검색어 지우기" onClick={()=>setQuery('')}>×</button>}<button aria-label="지도 설정과 시설 필터" aria-expanded={mapMenu} onClick={()=>setMapMenu(true)}>☷</button></div>
  <header className="dj-header"><a className="dj-brand" href="/"><img src="/icon-192.png" alt=""/><strong>갈수있슈<small>나에게 맞는 대전 여행길</small></strong></a><div className="dj-location"><i/>대전광역시 <span>5개 구 전체</span></div><nav aria-label="지도 화면"><button className="active" aria-current="page">대전 지도</button><button onClick={()=>onPilotAssets()}>3D 에셋 살펴보기</button></nav><button className="dj-profile" onClick={()=>setSurvey(true)}>☷ <span>나의 이동 조건</span></button></header>
  <main className="dj-layout">
   <nav className="desktop-rail" aria-label="지도 도구"><button aria-current={panelMode==='search'?'page':undefined} onClick={()=>{setPanelOpen(true);setPanelMode('search');setSelected(null);setQuery('');setMobileMode('browse');search.current?.focus();}}><span aria-hidden="true">⌕</span>장소 찾기</button><button aria-current={panelMode==='route'?'page':undefined} onClick={()=>{setPanelOpen(true);setPanelMode('route');setSelected(null);}}><span aria-hidden="true">⇄</span>길찾기</button><button onClick={()=>setSurvey(true)}><span aria-hidden="true">☷</span>내 조건</button></nav>
   <aside id="journey-sidebar" className={'dj-panel '+(sheet?'expanded':'')} aria-label="장소와 이동 계획">
    <div className="dj-mobile-summary"><div><strong>{mobileMode==='place'&&selected?selected.name:mobileMode==='route'?'길찾기':'검색 결과'}</strong><small>{mobileMode==='place'&&selected?accessLabel(selected):mobileMode==='route'?(transitSimulation?`대중교통 · 약 ${Math.round(transitSimulation.totalMinutes)}분`:route?formatDistance(route.distance)+' · 약 '+route.minutes+'분':'출발지와 도착지를 선택해 주세요'):filtered.length.toLocaleString()+'곳'}</small></div><button aria-label={sheetLevel==='full'?'패널 접기':'상세정보 펼치기'} onClick={()=>setSheetLevel(sheetLevel==='full'?'peek':'full')}>{sheetLevel==='full'?'접기':'펼치기'}</button><button aria-label="선택 닫고 지도 보기" onClick={()=>{setSelected(null);setPicking(null);setMobileMode('browse');setSheet(false);}}>×</button></div><div className="dj-scroll" ref={panelScroll}>
    <div className="dj-desktop-intro">
    <div className="dj-search"><span>⌕</span><input ref={search} aria-label={picking?`${picking==='from'?'출발지':'도착지'} 검색`:'대전 장소 검색'} placeholder={picking?`${picking==='from'?'출발지':'도착지'}를 검색하거나 지도에서 선택`:'장소·편의시설 검색'} value={query} onChange={e=>{setQuery(e.target.value);setSelected(null);}}/>{query&&<button aria-label="검색 지우기" onClick={()=>setQuery('')}>×</button>}</div>
    <div className="dj-panel-tabs" role="tablist" aria-label="패널 모드"><button role="tab" aria-selected={panelMode==='search'} onClick={()=>{setPanelMode('search');setPicking(null);}}>장소 찾기</button><button role="tab" aria-selected={panelMode==='route'} onClick={()=>{setPanelMode('route');setSelected(null);}}>길찾기</button></div>
    </div>{picking&&<div className="dj-picking" role="status">{picking==='from'?'출발지':'도착지'}로 사용할 장소를 선택해 주세요.<button onClick={()=>setPicking(null)}>취소</button></div>}
    {panelMode==='route'&&<div className="dj-planner"><div className="dj-endpoints"><button onClick={()=>beginEndpoint('from')}><i className="start"/><span>출발</span><strong>{from?.name||'출발지를 선택해 주세요'}</strong></button><button className="dj-swap" aria-label="출발 도착 바꾸기" onClick={()=>{setFrom(to);setTo(from);}}>⇅</button><button onClick={()=>beginEndpoint('to')}><i className="finish"/><span>도착</span><strong>{to?.name||'도착지를 선택해 주세요'}</strong></button></div>
    <div className="route-mode-tabs" role="tablist" aria-label="이동 방법"><button role="tab" aria-selected={travelMode==='walk'} onClick={()=>{setTravelMode('walk');useTransitJourney(null);}}>보행·휠체어</button><button role="tab" aria-selected={travelMode==='transit'} onClick={()=>{setTravelMode('transit');setRoute(null);setPreview(false);}}>대중교통</button></div>
    {travelMode==='walk'?<><button className="dj-route-button" disabled={routing||!data} onClick={calculate}>{routing?'기록된 도로를 확인하고 있어요…':'내 조건으로 이동 동선 찾기'} <span>→</span></button><div className="dj-condition-summary"><span>{prefs.steps?'계단 피하기':'계단 포함 가능'}</span>{prefs.steep&&<span>급경사 피하기</span>}{prefs.rough&&<span>거친 노면 피하기</span>}<button onClick={()=>setSurvey(true)}>변경</button></div></>:<TransitOptions from={from} to={to} onModels={onPilotAssets} onJourney={useTransitJourney} autoRun={autoRun} walkPaths={walkPaths} tourFor={place=>place?tourById.get(place.id)??null:null}/>}</div>}{panelMode==='search'&&!selected&&!route&&!transitSimulation&&!query&&data&&<TravelDestinations places={data.places} onChoose={choose}/>}
    {routeError&&<div className="dj-warning" role="alert">{routeError}</div>}
    {route&&<article className="dj-route-result"><div className="dj-section-title"><h2>이동 동선</h2><button onClick={()=>setRoute(null)} aria-label="동선 닫기">×</button></div><div className="dj-route-numbers"><strong>{formatDistance(route.distance)}<small>지도에 기록된 도로</small></strong><strong>약 {route.minutes}분<small>설정 속도 기준 추정</small></strong></div><div className="dj-warning"><b>접근성이 검증된 경로는 아니에요</b><p>노면·경사·휠체어 정보가 일부 없는 구간 {formatDistance(route.unknownDistance)}. 출입구 연결 약 {formatDistance(route.connectorDistance)}도 현장 확인이 필요해요.</p></div><p className="dj-quiet">실선은 기록된 도로, 점선은 위치와 도로 사이의 미확인 연결이에요. 신호·대기·휴식 시간은 포함하지 않았어요.</p><button className="dj-text-button" onClick={()=>view.current?.fitRoute(route.coordinates)}>동선 전체 보기 ↗</button>{!compat&&<button className="dj-text-button" aria-pressed={preview} onClick={()=>setPreview(!preview)}>{preview?"Ⅱ 미리보기 멈추기":"▶ 3D 여행자 동선 미리보기"}</button>}<p className="dj-quiet">여행자는 동선을 보여주는 시연 마커이며 실제 현재 위치가 아니에요.</p></article>}
    {route&&<article className="dj-route-result"><RouteDetails key={request.current} route={route} places={data?.places??[]} rest={prefs.rest} onChoose={choose} onFocus={coordinates=>view.current?.fitRoute(coordinates)}/></article>}
    <div className="dj-browse-results"><div className="dj-section-title"><h2>{query?'검색 결과':district==='전체'?'대전의 장소들':district+'의 장소들'}</h2><span>{filtered.length.toLocaleString()}곳</span></div>{dataError&&<div className="dj-warning">장소 정보를 불러오지 못했어요. 새로고침해 주세요.</div>}{!data&&!dataError&&<p className="dj-quiet">대전 장소를 불러오는 중이에요…</p>}{data&&filtered.length===0&&<div className="dj-empty">수집된 정보에서 찾지 못했어요.<p>검색어·지역·시설 종류를 바꾸거나 지도에서 위치를 직접 선택해 주세요.</p></div>}<div className="dj-place-list">{filtered.slice(0,limit).map(p=><div key={p.id} className={'dj-place-row'+(selected?.id===p.id?' is-open':'')}><button className="dj-place-main" onClick={()=>choose(p)}><span className="dj-place-symbol" style={{color:categories[p.category]?.color}}>{p.thumbnail||p.image?<img src={p.thumbnail||p.image} alt="" loading="lazy" onError={e=>{(e.currentTarget as HTMLImageElement).hidden=true;}}/>:null}<i aria-hidden="true">{categories[p.category]?.icon}</i></span><span><strong>{p.name}</strong><small>{p.district} · {categories[p.category]?.label}</small><em className={p.verified?'documented':''}>{accessLabel(p)}</em></span></button><div className="dj-row-actions"><button onClick={()=>setEndpoint(p,'from')}>출발</button><button className="is-end" onClick={()=>setEndpoint(p,'to')}>도착</button></div></div>)}</div>{filtered.length>limit&&<button className="dj-more" onClick={()=>setLimit(x=>x+24)}>장소 더 보기 ({Math.min(limit,filtered.length)} / {filtered.length})</button>}</div>
    <footer className="dj-data-footer"><strong>등록된 정보만 표시해요</strong><p>건물 외곽선은 OSM·Overture 자료를 함께 사용해요. 높이가 없는 건물은 추정 높이로 표현하며, 빠진 건물이 있을 수 있어요. 다리는 등록된 위치를 따르지만 폭·난간은 일부 재구성이에요. 모형은 접근성 판단 자료가 아니에요.</p><p><a href="/data/building-data-report.json" target="_blank" rel="noreferrer">건물 데이터 출처·보완 내역 ↗</a> · <a href="/data/building-footprints.geojson.gz" download>외곽선 데이터</a></p><button onClick={onLegacy}>기존 한밭수목원 여행 화면 ↗</button></footer>
   </div></aside>
   {selected&&<aside className="dj-detail-pane" aria-label={selected.name+' 상세'}><header className="dj-detail-head"><button className="dj-detail-back" aria-label="목록으로" onClick={()=>{setSelected(null);setMobileMode('browse');}}>‹</button><strong>{selected.name}</strong><button className="dj-detail-close" aria-label="닫기" onClick={()=>{setSelected(null);setMobileMode('browse');}}>×</button></header><div className="dj-detail-scroll"><div className="dj-detail-actions"><button onClick={()=>setEndpoint(selected,'from')}>출발</button><button className="is-end" onClick={()=>setEndpoint(selected,'to')}>도착</button><button className="is-sim" onClick={()=>runSimulationTo(selected)}>▶ 3D로 가보기</button></div><article className="dj-place-detail">{selected.image&&<img className="dj-place-photo" src={selected.image} alt={selected.name+' 장소 사진'}/>}<span className="dj-place-meta">{selected.district} · {categories[selected.category]?.label||'장소'}</span><h2>{selected.name}</h2><div className={'dj-access-badge '+(selected.verified?'documented':selected.wheelchair==='no'?'limited':'')}>{accessLabel(selected)}</div>
     {pilotAssetForPlace(selected.id)&&<button className="dj-model-link" onClick={()=>onPilotAssets(pilotAssetForPlace(selected.id))}>이 장소의 3D 외관 살펴보기 ↗</button>}
     <AccessDetails key={selected.id} place={selected}/>
     {selectedTour&&<TourAccess place={selectedTour} companion={companion}/>}
     <h3>이동 전에 확인해 주세요</h3>{selected.accessNotes?<ul className="dj-facts">{selected.accessNotes.map(s=><li key={s}>{s}</li>)}</ul>:<p className="dj-detail-copy">출입구의 턱, 실제 경사, 엘리베이터 연결과 당일 운영 상태는 확인되지 않았어요.{selected.category==='elevator'?' 표시는 엘리베이터의 지도 등록 위치이며 정상 작동 여부를 뜻하지 않아요.':''}</p>}
     <dl className="dj-detail-data"><div><dt>운영 시간</dt><dd>{selected.hours||'등록 정보 없음 · 방문 전 확인'}</dd></div><div><dt>이용 조건</dt><dd>{selected.access==='customers'?'고객 이용으로 등록':selected.access==='private'?'사유 시설로 등록':selected.access==='no'?'이용 불가로 등록':selected.access==='yes'?'이용 가능으로 등록 · 운영 확인 필요':'이용 조건 미확인'}</dd></div>{selected.category==='toilet'&&<div><dt>휠체어 화장실</dt><dd>{selected.toiletWheelchair==='yes'?'가능 표기 · 시설 규격 확인 필요':selected.toiletWheelchair==='no'?'불가 표기':'정보 미확인'}</dd></div>}<div><dt>자료 기준</dt><dd>{selected.verified?'관광공사 안내 확인 '+selected.checkedAt:'OSM 스냅샷 '+data?.snapshot.slice(0,10)}<small>실시간 시설 상태가 아니에요.</small></dd></div></dl>
     <div className="dj-source-links">{selected.source&&<a href={selected.source} target="_blank" rel="noreferrer">자료 원문 ↗</a>}{selected.phone&&<a href={'tel:'+selected.phone.replace(/[^+\d-]/g,'')}>전화 문의 ↗</a>}</div>
     {nearby.length>0&&<><h3>주변에서 함께 확인하기</h3>{nearby.map(({p,m})=><button className="dj-nearby" key={p.id} onClick={()=>choose(p)}><span>{categories[p.category].icon}</span><strong>{p.name}<small>{formatDistance(m)} · 직선거리 · 운영 미확인</small></strong><span>↗</span></button>)}</>}
    </article></div></aside>}
   <section className={'dj-map-stage'+(simulationEngaged?' simulation-active':'')+(chipsOpen?' chips-open':'')} aria-label="대전 전역 탐색"><button className="sidebar-toggle" aria-controls="journey-sidebar" aria-expanded={panelOpen} aria-label={panelOpen?'사이드바 접기':'사이드바 펼치기'} onClick={()=>setPanelOpen(!panelOpen)}>{panelOpen?'‹':'›'}</button><DaejeonMap transitGeometry={transitGeometry} transitSimulation={transitSimulation} transitPlaying={transitPreview} transitProgress={transitProgress} focusedPins={!!query.trim()||category!=='all'} onEndpoint={mapEndpoint} terrainStrength={terrainStrength} onPilotState={setPilotState} onPilotPick={id=>{const p=getPilotPlace(data,id);if(p)choose(p);}} ref={view} places={mapPlaces} selected={selected?.id||''} from={from} to={to} route={route} preview={preview} progress={progress} follow={follow} wheelchair={prefs.wheelchair} onFollowChange={setFollow} onPick={choose} onPoint={c=>point(c)} onDetail={setDetailCount} onZoom={setZoom} onCompatibility={setCompat}/>
    <JourneyArrival arrived={!!((route&&progress>=1)||(transitSimulation&&transitProgress>=1))} destination={to?.name||'목적지'}/>
    {route&&!compat&&<JourneyPlayer route={route} playing={preview} progress={progress} speed={speed} follow={follow} onPlaying={setPreview} onSeek={setProgress} onSpeed={setSpeed} onFollow={setFollow} onDetails={()=>{setMobileMode('route');setSheetLevel('full');setPanelOpen(true);setPreview(false);setFollow(false);}}/>}
    {transitSimulation&&!compat&&<TransitJourneyPlayer simulation={transitSimulation} playing={transitPreview} progress={transitProgress} speed={speed} follow={follow} onPlaying={setTransitPreview} onSeek={setTransitProgress} onSpeed={setSpeed} onFollow={setFollow} onDetails={()=>{setMobileMode('route');setSheetLevel('full');setPanelOpen(true);setTransitPreview(false);setFollow(false);}}/>}
    <div className="dj-map-top"><button className="dj-map-top-toggle" aria-expanded={chipsOpen} aria-controls="dj-map-chips" onClick={()=>setChipsOpen(v=>!v)}>지도 옵션 <span aria-hidden="true">{chipsOpen?'⌃':'⌄'}</span></button><div id="dj-map-chips" className="dj-map-chips"><select className="dj-mobile-region" aria-label="대전 지역 선택" value={district} onChange={e=>changeDistrict(e.target.value)}>{['전체','서구','유성구','동구','중구','대덕구'].map(n=><option key={n} value={n}>{n==='전체'?'대전 전체':n}</option>)}</select><button className="dj-pilot-shortcut" disabled={!data} onClick={()=>{setDistrict('전체');setCategory('all');setQuery('');const p=getPilotPlace(data,pilotStops[0].id);if(p)choose(p);}}>대전역–중앙로 3D 시범 구간 ↗</button><div className="dj-districts" aria-label="대전 지역 선택">{['전체','서구','유성구','동구','중구','대덕구'].map(n=><button key={n} aria-pressed={district===n} className={district===n?'active':''} onClick={()=>changeDistrict(n)}>{n==='전체'?'대전 전체':n}</button>)}</div><div className="dj-categories" aria-label="장소 종류">{['all','attraction','culture','park','toilet','elevator','station','food'].map(c=><button key={c} aria-pressed={category===c} className={category===c?'active':''} onClick={()=>{setCategory(c);setSelected(null);setMobileMode('browse');setSheetLevel('peek');setChipsOpen(false);}}>{categories[c].icon} {categories[c].label}</button>)}</div></div></div>
    <div className="dj-map-controls"><button aria-label="지도 확대" onClick={()=>view.current?.zoom(1.5)}>＋</button><button aria-label="지도 축소" onClick={()=>view.current?.zoom(1/1.5)}>−</button><button aria-label="입체와 평면 전환" onClick={()=>view.current?.tilt()} disabled={compat}>3D</button><button aria-label="대전 전체 보기" onClick={()=>{view.current?.overview();setDistrict('전체');}}>⌖</button><button aria-label="내 현재 위치" onClick={locate}>◎</button></div>
    <div className="dj-map-caption"><span className="dj-mode-dot"/><strong>{compat?'대전 · 2D 호환 지도':detailCount?`건축 디테일 ${detailCount}동 표시`:'대전 · 실제 위치 3D 지도'}</strong><small>{compat?'장소 선택과 동선 탐색을 이용할 수 있어요.':zoom<16.2?'가까이 확대하면 창문·수목이 나타나요.':'드래그로 이동 · 오른쪽 드래그로 회전'}</small></div>
    {!compat&&(pilotState.loading>0||!!pilotState.visible||pilotState.failed>0)&&<div className={"dj-pilot-loading "+(pilotState.failed?'is-error':'is-routine')} role="status">{pilotState.loading?'주변 3D 건물을 불러오고 있어요…':pilotState.failed?'일부 3D 건물을 불러오지 못했어요. 기본 지도는 계속 사용할 수 있어요.':`3D 랜드마크 ${pilotState.visible}동 표시 · 나무·차량은 거리 연출이에요.`}</div>}
        {!route&&!transitSimulation&&<><button className="dj-demo-shortcut" disabled={!data} onClick={runDemo}><b>▶ 대전역 → 한빛탑 3D로 보기</b><small>보행 · 지하철 · 환승 · 버스를 이어서 재생해요</small></button><button className="dj-expo-shortcut" onClick={onStationExperience}>대전역 광장 3D 체험 <span>↗</span></button></>}
   </section>
  </main>
  <nav className="dj-mobile-nav" aria-label="주요 기능"><button aria-current={mobileMode==='browse'?'page':undefined} onClick={()=>{setMobileMode('browse');setPanelMode('search');setSelected(null);setPicking(null);setSheet(false);mobileSearch.current?.blur();}}><span>⌖</span>지도</button><button aria-current={mobileMode==='search'?'page':undefined} onClick={()=>{setSelected(null);setPanelMode('search');setMobileMode('search');setSheet(true);mobileSearch.current?.focus();}}><span>⌕</span>검색</button><button aria-current={mobileMode==='route'?'page':undefined} onClick={()=>{setPanelMode('route');setMobileMode('route');setSelected(null);setPicking(null);setSheetLevel(route?'full':'half');mobileSearch.current?.blur();}}><span>⇄</span>길찾기</button><button onClick={()=>setSurvey(true)}><span>☷</span>이동 조건</button></nav>
  <Dialog.Root open={mapMenu} onOpenChange={setMapMenu}><Dialog.Portal><Dialog.Overlay className="dj-survey-overlay"/><Dialog.Content className="dj-survey dj-map-menu"><Dialog.Close className="dj-survey-close" aria-label="지도 설정 닫기">×</Dialog.Close><Dialog.Title>지도 설정</Dialog.Title><Dialog.Description>필요한 장소와 지도 도구만 골라보세요.</Dialog.Description><button className="dj-route-button" onClick={()=>{setMapMenu(false);onStationExperience();}}>대전역 광장 3D 체험 →</button><h3>지역</h3><select aria-label="탐색 지역" value={district} onChange={e=>changeDistrict(e.target.value)}>{['전체','서구','유성구','동구','중구','대덕구'].map(n=><option key={n} value={n}>{n==='전체'?'대전 전체':n}</option>)}</select><h3>시설·장소</h3><div className="dj-menu-options">{['all','toilet','elevator','station','park','attraction','culture','food'].map(c=><button key={c} aria-pressed={category===c} onClick={()=>{setCategory(c);setSelected(null);setMobileMode('browse');setSheet(false);setMapMenu(false);}}>{categories[c].icon} {categories[c].label}</button>)}</div><h3>지도 도구</h3><div className="dj-menu-options"><button onClick={()=>view.current?.zoom(1.5)}>확대 ＋</button><button onClick={()=>view.current?.zoom(1/1.5)}>축소 −</button><button disabled={compat} onClick={()=>{view.current?.tilt();setMapMenu(false);}}>2D / 3D 전환</button><button onClick={()=>{view.current?.overview();setMapMenu(false);}}>대전 전체 보기</button></div><button className="dj-route-button" disabled={!data} onClick={()=>{setMapMenu(false);setDistrict('전체');setCategory('all');const p=getPilotPlace(data,pilotStops[0].id);if(p)choose(p);}}>대전역 3D 시범 구간 →</button><fieldset className="terrain-settings" disabled={compat}><legend>지형 높낮이</legend><div>{[[0,"평면"],[1,"기본"],[1.5,"강조"],[2,"더 강조"]].map(([value,label])=><button key={value} aria-pressed={terrainStrength===value} onClick={()=>setTerrainStrength(Number(value))}>{label}</button>)}</div><p>지형 표시 {terrainStrength}배 · 경사 안내 수치는 바뀌지 않아요.</p><button onClick={()=>{setMapMenu(false);view.current?.fly([127.455,36.31],14);}}>식장산 주변 지형 보기 ↗</button></fieldset><button className="dj-model-link" onClick={()=>{setMapMenu(false);onPilotAssets();}}>3D 에셋 살펴보기 ↗</button><p className="dj-quiet">일부 지역은 건물 자료가 빠져 있어요. 빈 공간이 실제 공터라는 뜻은 아니에요. 다리의 폭·난간, 창문·나무·차량은 일부 재구성이며, 통행 가능 여부를 뜻하지 않아요.</p></Dialog.Content></Dialog.Portal></Dialog.Root>
  <MobilitySurvey open={survey} onOpenChange={setSurvey} value={prefs} onSave={savePrefs} coverage={coverage} companion={companion} tour={tour?.counts??null}/>
  {notice&&<div className="dj-toast" role="status">{notice}</div>}
 </div>;
}
