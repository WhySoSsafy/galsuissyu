// Two Tourism Organization datasets that answer things our own map could not.
//
// Audio guides fill a blank we report on our own first screen: no place in Daejeon has a hearing or
// vision guide registered in the barrier-free records. A spoken guide is a way into a place for
// someone who cannot read the sign, and its script is one for someone who cannot hear it.
//
// Congestion is the barrier nobody maps. A packed plaza is not passable with a wheelchair, a
// stroller or a cane in the way it is on a quiet Tuesday — same place, same step-free entrance,
// different day. The Organization forecasts it per attraction; we turn that into a day to go on.

export type AudioGuide={id:string;place:string;title:string;script:string;seconds:number|null;audio:string|null;lon:number;lat:number};
export type AudioGuides={source:string;fetchedAt:string;guides:AudioGuide[]};

export type CongestionSpot={name:string;district:string;from:string;rates:number[]};
export type Congestion={
 source:string;fetchedAt:string;
 covers:{from:string;days:number};
 weekly:{period:string;days:{day:string;visitors:number}[]};
 spots:CongestionSpot[];
};

const tidy=(s:string)=>s.replace(/[\s·()（）]/g,'').toLowerCase();
const metres=(a:{lon:number;lat:number},b:{lon:number;lat:number})=>{
 const lat=(a.lat+b.lat)/2*Math.PI/180;
 return Math.hypot((a.lon-b.lon)*Math.cos(lat),a.lat-b.lat)*111320;
};

// Both matches run on a name, and a loose one is worse than none: proximity alone handed a urology
// clinic the guide for the cathedral across the street, and a place called "대전" swallowed every
// record whose name contains it. So a name has to relate, and a short one has to match outright —
// two or three characters are a substring of half the city.
const SHORTEST_PARTIAL=4;
function samePlace(a:string,b:string){
 const [x,y]=[tidy(a),tidy(b)];
 if(!x||!y)return false;
 if(x===y)return true;
 return Math.min(x.length,y.length)>=SHORTEST_PARTIAL&&(x.includes(y)||y.includes(x));
}

// A guide is pinned to its own stop, which can be a corner of a large site, so a related name still
// has to be within walking reach of the place it is offered on.
export const NEAR_ENOUGH=350;
export function guidesFor(data:AudioGuides|null,place:{name:string;lon:number;lat:number}|null){
 if(!data?.guides?.length||!place)return [];
 return data.guides.filter(g=>metres(g,place)<=NEAR_ENOUGH&&samePlace(g.place,place.name));
}

// A forecast that has run out is not a forecast. Rather than showing yesterday's prediction, the
// days before today are dropped and an empty result hides the panel.
export function forecastFor(data:Congestion|null,place:{name:string}|null,today=new Date()){
 if(!data?.spots?.length||!place)return null;
 const spot=data.spots.find(s=>tidy(s.name)===tidy(place.name))
  ??data.spots.find(s=>samePlace(s.name,place.name));
 if(!spot)return null;

 const start=new Date(`${spot.from.slice(0,4)}-${spot.from.slice(4,6)}-${spot.from.slice(6,8)}T00:00:00`);
 const days=spot.rates.map((rate,i)=>{
  const date=new Date(start);date.setDate(date.getDate()+i);
  return {date,rate};
 }).filter(d=>d.date.getTime()>=new Date(today.getFullYear(),today.getMonth(),today.getDate()).getTime());
 if(days.length<3)return null;

 const week=days.slice(0,7);
 const quietest=week.reduce((best,d)=>d.rate<best.rate?d:best,week[0]);
 const busiest=week.reduce((worst,d)=>d.rate>worst.rate?d:worst,week[0]);
 // A flat week has no advice worth giving; saying "go Tuesday" over a 2% difference is noise.
 const meaningful=busiest.rate-quietest.rate>=8;
 return {name:spot.name,district:spot.district,week,quietest,busiest,meaningful};
}

const load=async<T>(path:string,signal?:AbortSignal):Promise<T|null>=>{
 try{
  // A missing file is answered by the single-page fallback — index.html, with a 200.
  const response=await fetch(path,{signal});
  if(!response.ok||!response.headers.get('content-type')?.includes('json'))return null;
  return await response.json() as T;
 }catch{return null;}
};
export const loadAudioGuides=(signal?:AbortSignal)=>load<AudioGuides>('/data/audio-guides.json',signal);
export const loadCongestion=(signal?:AbortSignal)=>load<Congestion>('/data/congestion.json',signal);
