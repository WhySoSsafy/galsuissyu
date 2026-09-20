import {distance,type Coordinate} from './city-data';
import type {TransitGeometry,TransitRoute,TransitSimulation,TransitSimulationPoint,TransitSimulationSegment} from './transit-types';

const pathDistance=(coordinates:Coordinate[])=>coordinates.slice(1).reduce((sum,p,i)=>sum+distance(coordinates[i],p),0);
const same=(a:Coordinate,b:Coordinate)=>Math.abs(a[0]-b[0])<1e-9&&Math.abs(a[1]-b[1])<1e-9;

function join(parts:Coordinate[][]){
 const result:Coordinate[]=[];
 for(const part of parts)for(const p of part)if(!result.length||!same(result.at(-1)!,p))result.push(p);
 return result;
}

// ODsay names the boarding and alighting stops of a ride but leaves walk legs anonymous, which
// surfaced in the UI as a literal "이전 지점 → 다음 지점". A walk is always bounded by the stop it
// just left and the one it is heading for, so borrow those names; the ends of the trip fall back to
// the places the traveller actually picked.
export function nameWalkLegs(route:TransitRoute,originName:string,destinationName:string):TransitRoute{
 const legs=route.legs.map((leg,index)=>{
  if(leg.mode!=='walk')return leg;
  const before=route.legs.slice(0,index).reverse().find(l=>l.mode!=='walk');
  const after=route.legs.slice(index+1).find(l=>l.mode!=='walk');
  return {...leg,start:leg.start??before?.end??originName,end:leg.end??after?.start??destinationName};
 });
 return {...route,legs};
}

// A walk that starts and ends at the same named place is movement inside it — the station concourse,
// the bus stop forecourt — and "대전역 → 대전역" reads like a mistake.
// The walk between a stop and the next one was drawn as a straight line, which sent the traveller
// through rail yards and across rivers. Given real paths from the walking network, swap them in and
// re-time the run; a leg the network could not connect keeps its straight line.
export function withWalkPaths(simulation:TransitSimulation,paths:(Coordinate[]|null)[]):TransitSimulation{
 let index=0,changed=false;
 const drafts=simulation.segments.map(segment=>{
  if(segment.mode!=='walk')return segment;
  const path=paths[index++];
  if(!path||path.length<2)return segment;
  changed=true;
  // Keep the provider's own timing for the leg; only the shape it takes on the map changes.
  return {...segment,coordinates:path};
 });
 if(!changed)return simulation;
 const totalMinutes=Math.max(1,drafts.reduce((sum,s)=>sum+s.minutes,0));
 let elapsed=0;
 const segments=drafts.map(s=>{const startProgress=elapsed/totalMinutes;elapsed+=s.minutes;return {...s,startProgress,endProgress:elapsed/totalMinutes};});
 return {...simulation,segments,coordinates:join(segments.map(s=>s.coordinates)),totalMinutes};
}

// The endpoints of each walk leg, in the order withWalkPaths expects them back.
export function walkLegEndpoints(simulation:TransitSimulation){
 return simulation.segments.filter(s=>s.mode==='walk').map(s=>({from:s.coordinates[0],to:s.coordinates.at(-1)!}));
}

// The path already covered, so the map can show progress the way the walking mode does instead of
// leaving one flat line for the whole trip.
export function travelledCoordinates(simulation:TransitSimulation,progress:number):Coordinate[]{
 const point=transitPoint(simulation,progress);
 const out:Coordinate[]=[];
 for(const segment of simulation.segments){
  if(segment.startProgress>=point.segment.startProgress&&segment!==point.segment)break;
  if(segment!==point.segment){out.push(...segment.coordinates);continue;}
  // Walk into the active leg only as far as the traveller has actually gone.
  const lengths=[0];
  for(let i=1;i<segment.coordinates.length;i++)lengths.push(lengths[i-1]+distance(segment.coordinates[i-1],segment.coordinates[i]));
  const target=point.pathProgress*(lengths.at(-1)||0);
  for(let i=0;i<segment.coordinates.length&&lengths[i]<=target;i++)out.push(segment.coordinates[i]);
  out.push(point.coordinate);
  break;
 }
 return out.length>1?out:[];
}

export function legSpan(start:string|null,end:string|null){
 if(!start||!end)return '구간 정보 미확인';
 return start===end?`${start} 안에서 이동`:`${start} → ${end}`;
}

export function buildTransitSimulation(route:TransitRoute,geometry:TransitGeometry,origin:Coordinate,destination:Coordinate,originName='출발지',destinationName='도착지'):TransitSimulation{
 const groups=new Map<number,{mode:'bus'|'subway';parts:Coordinate[][]}>();
 for(const feature of [...geometry.features].sort((a,b)=>a.properties.order-b.properties.order||a.properties.section-b.properties.section)){
  const row=groups.get(feature.properties.order)??{mode:feature.properties.mode,parts:[]};row.parts.push(feature.geometry.coordinates as Coordinate[]);groups.set(feature.properties.order,row);
 }
 const rides=[...groups.entries()].sort((a,b)=>a[0]-b[0]).map(([,g])=>({mode:g.mode,coordinates:join(g.parts)})).filter(x=>x.coordinates.length>1);
 let rideIndex=0,current=origin;
 const drafts:Omit<TransitSimulationSegment,'startProgress'|'endProgress'>[]=[];
 for(const [index,leg] of route.legs.entries()){
  if(leg.mode==='walk'){
   const next=rides.slice(rideIndex).find(r=>r.coordinates.length>1);const target=next?.coordinates[0]??destination;
   const coordinates=same(current,target)?[current,current]:[current,target];
   drafts.push({id:`walk-${index}`,mode:'walk',line:'',start:leg.start,end:leg.end,minutes:Math.max(.35,leg.minutes??pathDistance(coordinates)/65),coordinates});current=target;continue;
  }
  let at=rides.findIndex((r,i)=>i>=rideIndex&&r.mode===leg.mode);if(at<0)at=rideIndex;
  const ride=rides[at];rideIndex=Math.max(rideIndex,at+1);
  let coordinates=(ride?.coordinates??[leg.from??current,leg.to??destination]).filter(Boolean) as Coordinate[];
  if(coordinates.length<2)coordinates=[current,destination];
  const expected=leg.from??current;if(distance(coordinates.at(-1)!,expected)<distance(coordinates[0],expected))coordinates=[...coordinates].reverse();
  drafts.push({id:`${leg.mode}-${index}`,mode:leg.mode,line:leg.line,start:leg.start,end:leg.end,minutes:Math.max(.5,leg.minutes??pathDistance(coordinates)/(leg.mode==='subway'?550:320)),coordinates});current=coordinates.at(-1)!;
 }
 if(!same(current,destination))drafts.push({id:'walk-final',mode:'walk',line:'',start:route.legs.filter(l=>l.mode!=='walk').at(-1)?.end??originName,end:destinationName,minutes:Math.max(.35,pathDistance([current,destination])/65),coordinates:[current,destination]});
 const totalMinutes=Math.max(1,drafts.reduce((sum,s)=>sum+s.minutes,0));let elapsed=0;
 const segments=drafts.map(s=>{const startProgress=elapsed/totalMinutes;elapsed+=s.minutes;return {...s,startProgress,endProgress:elapsed/totalMinutes};});
 return {route,segments,coordinates:join(segments.map(s=>s.coordinates)),totalMinutes};
}

export function transitPoint(simulation:TransitSimulation,progress:number):TransitSimulationPoint{
 const p=Math.max(0,Math.min(1,progress));const segment=simulation.segments.find(s=>p<s.endProgress)??simulation.segments.at(-1)!;
 const segmentProgress=Math.max(0,Math.min(1,(p-segment.startProgress)/(segment.endProgress-segment.startProgress||1)));
 // Reserve the ends of each ride for stationary boarding/alighting, not teleporting.
 const dwell=.10;
 const phase=p>=1?'arrived':segment.mode==='walk'?'walk':segmentProgress<dwell?'boarding':segmentProgress>1-dwell?'alighting':'riding';
 const rideProgress=Math.max(0,Math.min(1,(segmentProgress-dwell)/(1-2*dwell)));
 const pathProgress=segment.mode==='walk'?segmentProgress:rideProgress*rideProgress*(3-2*rideProgress);
 const phaseProgress=phase==='boarding'?segmentProgress/dwell:phase==='alighting'?(segmentProgress-1+dwell)/dwell:pathProgress;
 const lengths=[0];for(let i=1;i<segment.coordinates.length;i++)lengths.push(lengths[i-1]+distance(segment.coordinates[i-1],segment.coordinates[i]));
 const target=pathProgress*(lengths.at(-1)||0);let i=1;while(i<lengths.length-1&&lengths[i]<target)i++;
 const a=segment.coordinates[Math.max(0,i-1)],b=segment.coordinates[Math.min(i,segment.coordinates.length-1)],t=(target-lengths[Math.max(0,i-1)])/(lengths[Math.min(i,lengths.length-1)]-lengths[Math.max(0,i-1)]||1);
 return {coordinate:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],heading:Math.atan2(b[1]-a[1],(b[0]-a[0])*Math.cos(a[1]*Math.PI/180)),segment,segmentProgress,pathProgress,phase,phaseProgress};
}

export function transitStatus(point:TransitSimulationPoint){
 const vehicle=point.segment.mode==='bus'?'버스':'지하철';
 if(point.phase==='arrived')return '도착했어요 · 미리보기 완료';
 if(point.phase==='walk')return '보행 이동';
 return `${point.segment.line||vehicle} · ${point.phase==='boarding'?'승차 중':point.phase==='alighting'?'하차 중':'탑승 이동 중'}`;
}

export function transitSimulationGeoJSON(simulation:TransitSimulation):GeoJSON.FeatureCollection<GeoJSON.LineString>{
 return {type:'FeatureCollection',features:simulation.segments.map((s,index)=>({type:'Feature',properties:{mode:s.mode,line:s.line,order:index},geometry:{type:'LineString',coordinates:s.coordinates}}))};
}
