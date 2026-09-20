import {useEffect,useMemo,useRef,useState} from 'react';
import {formatDistance,type CityPlace,type Coordinate} from './city-data';import type {PilotAssetId} from './pilot-data';import type {TransitRoute,TransitGeometry,TransitSimulation} from './transit-types';
import {lowFloorBuses,type TourPlace} from './tour-data';import {findRecorded,loadRecorded,type RecordedJourney,type RecordedRoutes} from './recorded-routes';import {buildTransitSimulation,legSpan,nameWalkLegs,walkLegEndpoints,withWalkPaths} from './transit-simulation';
const base=import.meta.env.VITE_TRANSIT_API_URL?.replace(/\/$/,'')??'';
async function api(path:string,body:unknown,signal:AbortSignal){
 const response=await fetch(base+'/api/transit/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
 if(!response.headers.get('content-type')?.includes('application/json'))throw Error('대중교통 서버에 연결하지 못했어요.');const data=await response.json();if(!response.ok)throw Error(data.error||'경로를 불러오지 못했어요.');return data;
}
export function TransitOptions({from,to,onModels,onJourney,autoRun,onAutoRunDone,recorded,tourFor,walkPaths}:{from:CityPlace|null;to:CityPlace|null;onModels:(id:PilotAssetId)=>void;onJourney:(journey:TransitSimulation|null)=>void;autoRun?:number;onAutoRunDone?:(played:boolean)=>void;recorded?:boolean;tourFor?:(place:CityPlace|null)=>TourPlace|null;walkPaths?:(legs:{from:Coordinate;to:Coordinate}[])=>Promise<(Coordinate[]|null)[]|null>}){
 const [mode,setMode]=useState('all'),[routes,setRoutes]=useState<TransitRoute[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[searched,setSearched]=useState(false),[selected,setSelected]=useState<string|null>(null),[drawing,setDrawing]=useState(false),[fromRecording,setFromRecording]=useState(false);
 // The Tourism Organization lists low-floor routes serving a place, so a bus on this trip can be
 // checked against the ones registered at either end. Nothing is claimed for buses it never mentions.
 const lowFloor=useMemo(()=>{
  const set=new Set<string>();
  for(const place of [from,to]){const record=tourFor?.(place);if(record)for(const n of lowFloorBuses(record))set.add(n);}
  return set;
 },[from,to,tourFor]);
 const request=useRef<AbortController|null>(null),geometryRequest=useRef<AbortController|null>(null);const change=useRef(onJourney);change.current=onJourney;
 // Shipped with the build, so the trips people actually ask for cost the provider nothing and keep
 // working when its allowance is gone. Consulted before every search, not just the demo.
 const [library,setLibrary]=useState<RecordedRoutes|null>(null);
 useEffect(()=>{const c=new AbortController();loadRecorded(c.signal).then(setLibrary);return()=>c.abort();},[]);
 const recording=useMemo(()=>findRecorded(library,from,to,mode),[library,from?.name,from?.lon,from?.lat,to?.name,to?.lon,to?.lat,mode]);
 useEffect(()=>{request.current?.abort();geometryRequest.current?.abort();setBusy(false);setDrawing(false);setRoutes([]);setError('');setSearched(false);setSelected(null);setFromRecording(false);change.current(null);return()=>{request.current?.abort();geometryRequest.current?.abort();};},[from?.id,to?.id,mode]);
 // The demo entry point plays a recorded answer when one is committed, so a judging session costs
 // the provider nothing and still works when its allowance is gone. Without the file it falls back
 // to a live search, and it never invents a result either way.
 const auto=useRef({search,show,play});auto.current={search,show,play};
 useEffect(()=>{
  if(!autoRun||!from||!to)return;let cancelled=false;
  (async()=>{
   // The demo is just the first of the recorded journeys; wait for the library rather than racing it.
   const saved=library??await loadRecorded();
   if(cancelled)return;
   const journey=findRecorded(saved,from,to,mode);
   if(journey){
    const played=await auto.current.play(journey);
    if(!cancelled)onAutoRunDone?.(played);
    return;
   }
   const found=await auto.current.search();if(cancelled)return;
   const playable=found?.find(r=>r.mapObj)??null;
   if(playable)await auto.current.show(playable);
   // Whoever sent us here cleared the screen for a run. Say whether one arrived, so a provider that
   // is down or out of allowance gives back a panel with the reason rather than an empty map.
   if(!cancelled)onAutoRunDone?.(!!playable);
  })();
  return()=>{cancelled=true;};
 },[autoRun,library]);
 // Shows a recorded journey exactly as a live one would be shown, without touching the provider.
 async function play(journey:RecordedJourney){
  if(!from||!to)return false;
  request.current?.abort();
  const named=journey.routes.map(r=>nameWalkLegs(r,from.name,to.name));
  setRoutes(named);setSearched(true);setFromRecording(true);setError('');setBusy(false);
  const playable=named.find(r=>r.id===journey.playableRouteId)??named.find(r=>r.mapObj);
  if(!playable)return false;
  await show(playable,journey.geometry);
  return true;
 }
 async function search(live=false){
  if(!from||!to||from.id===to.id)return;
  // A journey we already hold is answered from the recording. The provider's allowance is finite,
  // and spending it to be told again what is sitting in the build helps nobody. Asking for today's
  // running information is a deliberate act, so it takes its own button.
  const journey=live?null:findRecorded(library,from,to,mode);
  if(journey){await play(journey);return journey.routes;}
  request.current?.abort();geometryRequest.current?.abort();setDrawing(false);change.current(null);setSelected(null);const c=new AbortController();request.current=c;setBusy(true);setError('');setRoutes([]);setSearched(false);setFromRecording(false);try{const d=await api('routes',{from:[from.lon,from.lat],to:[to.lon,to.lat],mode},c.signal);if(c.signal.aborted)return;const found=(d.routes as TransitRoute[]).map(r=>nameWalkLegs(r,from.name,to.name));setRoutes(found);setSearched(true);return found;}catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:'경로 조회 실패');}finally{if(!c.signal.aborted)setBusy(false);}}
 async function show(route:TransitRoute,recordedGeometry?:TransitGeometry){if(!from||!to)return;geometryRequest.current?.abort();const c=new AbortController();geometryRequest.current=c;setSelected(route.id);setDrawing(true);setError('');change.current(null);try{
  const geometry:TransitGeometry=recordedGeometry??await api('geometry',{mapObj:route.mapObj},c.signal);
  if(c.signal.aborted)return;
  let simulation=buildTransitSimulation(route,geometry,[from.lon,from.lat],[to.lon,to.lat],from.name,to.name);
  // Draw the walking legs on real footpaths before showing the run; a straight line between stops
  // cuts through rail yards and rivers. If the network cannot answer, the straight line stands.
  const paths=await walkPaths?.(walkLegEndpoints(simulation));
  if(c.signal.aborted)return;
  if(paths)simulation=withWalkPaths(simulation,paths);
  change.current(simulation);
 }catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:'노선 표시 실패');}finally{if(!c.signal.aborted)setDrawing(false);}}
 return <section className="transit-entry" aria-label="대중교통 길찾기"><h3>버스·지하철 통합 경로</h3><div className="transit-modes" aria-label="대중교통 수단">{[['all','통합'],['subway','지하철'],['bus','버스']].map(([v,label])=><button key={v} aria-pressed={mode===v} onClick={()=>setMode(v)}>{label}</button>)}</div><p className="transit-endpoints">{from?.name||'출발지 선택'} → {to?.name||'도착지 선택'}</p><button className="transit-primary" disabled={busy||!from||!to||from.id===to.id} onClick={()=>search()}>{busy?'환승 경로를 찾고 있어요…':recording&&!searched?'저장된 경로로 바로 보기':'대중교통 경로 찾기'}</button>{error&&<p role="alert">{error}</p>}{searched&&!routes.length&&<p role="status">조건에 맞는 경로를 찾지 못했어요.</p>}{routes.map(r=><article className={'transit-route'+(selected===r.id?' selected':'')} key={r.id}><h3>{r.minutes===null?'소요시간 미확인':`약 ${r.minutes}분`} <small>보행 {r.walkDistance===null?'미확인':formatDistance(r.walkDistance)}</small></h3><p>{r.fare===null?'요금 미확인':`${r.fare.toLocaleString()}원 · 예상 요금`}</p><ol>{r.legs.map((l,i)=><li key={i}><b>{l.mode==='walk'?'보행':l.mode==='bus'?'버스 '+l.line:l.line||'지하철'}{l.mode==='bus'&&l.line.split(' / ').some(n=>lowFloor.has(n.trim()))&&<em className="low-floor">저상버스 등록 노선</em>}</b><span>{legSpan(l.start,l.end)}</span><small>{l.minutes===null?'시간 미확인':l.minutes+'분'}{l.stops!==null?' · '+l.stops+'개 정거장':''}{l.direction?' · '+l.direction+' 방면':''}</small></li>)}</ol><button disabled={!r.mapObj||drawing} aria-pressed={selected===r.id} onClick={()=>show(r)}>{drawing&&selected===r.id?'3D 환승 동선을 준비하고 있어요…':selected===r.id?'시뮬레이션 다시 보기':'이 경로로 3D 시뮬레이션'}</button></article>)}{fromRecording&&<p className="transit-recorded" role="status">함께 저장해 둔 실제 조회 결과예요. 지금 이 순간의 운행 정보는 아니에요. <button type="button" onClick={()=>search(true)} disabled={busy}>지금 운행 정보로 조회하기</button></p>}{routes.length>0&&<p>보행·버스·지하철과 환승 순서를 하나의 시뮬레이션으로 보여줘요. 보행 구간은 기록된 보행 도로를 따라 그리고, 연결되는 길을 찾지 못하면 승하차 지점을 직선으로 이어 표시해요.</p>}<p>저상버스 배차·엘리베이터 운영·실시간 도착은 미확인이에요.</p><button onClick={()=>onModels('metro-train')}>지하철·버스 3D 모형 살펴보기</button></section>;
}
