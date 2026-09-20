export type Coordinate=[number,number];
export type CityPlace={id:string;name:string;category:string;lon:number;lat:number;district?:string;wheelchair:string;toiletWheelchair:string;access:string;hours:string;phone:string;website:string;source:string;address:string;checkedAt:string;facilities:string[];verified:boolean;accessNotes?:string[];image?:string;thumbnail?:string};
export type District={id:string;name:string;center:Coordinate;bounds:[number,number,number,number];geometry:GeoJSON.Geometry};
export type CityData={snapshot:string;collectedAt:string;source:string;places:CityPlace[];districts:District[]};
export type Mobility={wheelchair:boolean;steps:boolean;rough:boolean;steep:boolean;rest:boolean};
// Geometric glyphs told a reader nothing about what a place is. These are the plainest pictures of
// each kind, which is what a list of unfamiliar names needs before anything else.
export const categories:Record<string,{label:string;icon:string;color:string}>={all:{label:'전체',icon:'📍',color:'#477764'},attraction:{label:'명소',icon:'🗺️',color:'#cb7052'},culture:{label:'문화',icon:'🏛️',color:'#a18250'},park:{label:'공원·쉼터',icon:'🌳',color:'#5b854f'},food:{label:'식당·카페',icon:'🍽️',color:'#a97153'},shopping:{label:'쇼핑',icon:'🛍️',color:'#a47d98'},station:{label:'역',icon:'🚉',color:'#6e7fab'},elevator:{label:'엘리베이터',icon:'🛗',color:'#3f8074'},toilet:{label:'화장실',icon:'🚻',color:'#508c80'},public:{label:'생활시설',icon:'🏢',color:'#758193'}};
export const districtCenters:Record<string,Coordinate>={'서구':[127.3849,36.3504],'유성구':[127.343,36.362],'동구':[127.433,36.333],'중구':[127.421,36.324],'대덕구':[127.429,36.397]};
export const cityBounds:[[number,number],[number,number]]=[[127.2463,36.1833],[127.5409,36.5003]];
export function distance(a:Coordinate,b:Coordinate){const r=Math.PI/180,dy=(b[1]-a[1])*r,dx=(b[0]-a[0])*r,h=Math.sin(dy/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dx/2)**2;return 12742000*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
export function placeCoordinate(p:CityPlace):Coordinate{return [p.lon,p.lat];}
export function formatDistance(m:number){return m<1000?`${Math.round(m)}m`:`${(m/1000).toFixed(1)}km`;}
export function accessLabel(p:CityPlace){return p.verified?'관광공사 시설 안내':p.wheelchair==='yes'?'OSM 휠체어 가능 표기':p.wheelchair==='no'?'OSM 휠체어 불가 표기':p.wheelchair==='limited'?'OSM 이용 제한 표기':'접근성 정보 미확인';}
export function pointInRing(p:Coordinate,ring:number[][]){let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
export function insideCity(p:Coordinate,g:GeoJSON.Geometry){if(g.type==='Polygon')return pointInRing(p,g.coordinates[0])&&!g.coordinates.slice(1).some(r=>pointInRing(p,r));if(g.type==='MultiPolygon')return g.coordinates.some(r=>pointInRing(p,r[0])&&!r.slice(1).some(h=>pointInRing(p,h)));return false;}

export type AccessCoverage={places:number;documented:number;toilets:number;toiletsDocumented:number;elevators:number;snapshot:string};

// The pitch for this app is a measurement, not an adjective: count how little of Daejeon's
// accessibility is actually written down, straight from the dataset we ship.
export function accessCoverage(data:CityData):AccessCoverage{
 // Bus stops joined the map so a journey can start at one, but they are not places anyone sets out
 // to visit, and counting them made the headline read 4,256 instead of the places it is about.
 const places=data.places.filter(p=>!p.id.startsWith('bus-'));
 const toilets=places.filter(p=>p.category==='toilet');
 return {
  places:places.length,
  documented:places.filter(p=>p.wheelchair!=='unknown').length,
  toilets:toilets.length,
  toiletsDocumented:toilets.filter(p=>p.toiletWheelchair==='yes').length,
  elevators:places.filter(p=>p.facilities?.includes('elevator')).length,
  snapshot:data.snapshot,
 };
}
