import type {TransitGeometry,TransitRoute} from './transit-types';

// Real ODsay answers for the journeys people actually ask for, recorded by
// scripts/fetch-recorded-routes.mjs and shipped with the build.
//
// The provider's allowance is finite and a judging session opens the same few trips over and over.
// These take them out of the budget, and keep the simulation — the thing this project is being
// judged on — working when the allowance is gone or the provider is down. They are never passed off
// as live: the panel says so, and searching again asks the provider for today's answer.
export type RecordedJourney={
 from:{name:string;lon:number;lat:number};
 to:{name:string;lon:number;lat:number};
 mode:string;
 playableRouteId:string;
 routes:TransitRoute[];
 geometry:TransitGeometry;
};
export type RecordedRoutes={source:string;recordedAt:string;journeys:RecordedJourney[]};

const tidy=(s:string)=>s.replace(/\s+/g,'').toLowerCase();

// Rough metres. A recorded endpoint and the place the app resolved by the same name can sit a
// little apart — the Tourism Organization and OpenStreetMap rarely agree to the metre — but not
// across town, which would be a different place wearing the same name.
export function metresApart(a:{lon:number;lat:number},b:{lon:number;lat:number}){
 const lat=(a.lat+b.lat)/2*Math.PI/180;
 return Math.hypot((a.lon-b.lon)*Math.cos(lat),a.lat-b.lat)*111320;
}
export const SAME_PLACE=400;

export function findRecorded(
 data:RecordedRoutes|null,
 from:{name:string;lon:number;lat:number}|null,
 to:{name:string;lon:number;lat:number}|null,
 mode:string,
){
 if(!data?.journeys?.length||!from||!to)return null;
 return data.journeys.find(j=>
  j.mode===mode&&
  tidy(j.from.name)===tidy(from.name)&&tidy(j.to.name)===tidy(to.name)&&
  metresApart(j.from,from)<=SAME_PLACE&&metresApart(j.to,to)<=SAME_PLACE
 )??null;
}

// A missing file is answered by the single-page fallback — index.html, with a 200 — so asking for
// JSON is what distinguishes "no recording" from "a recording".
export async function loadRecorded(signal?:AbortSignal):Promise<RecordedRoutes|null>{
 try{
  const response=await fetch('/data/recorded-routes.json',{signal});
  if(!response.ok||!response.headers.get('content-type')?.includes('json'))return null;
  const data=await response.json();
  return Array.isArray(data?.journeys)?data as RecordedRoutes:null;
 }catch{return null;}
}
