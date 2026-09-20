import {solveRoute,type WalkNetwork} from './route-engine';
import {routeElevation,type ElevationGrid} from './elevation';
let network:Promise<WalkNetwork>|null=null;
let elevation:Promise<ElevationGrid|null>|undefined;
// Two jobs share one network load: a full route for the walking mode, and the short hops between a
// bus stop and the next one, which the transit simulation used to draw as straight lines.
self.onmessage=async e=>{const {id,from,to,prefs,legs}=e.data;try{network??=fetch('/data/walk-network.json').then(r=>{if(!r.ok)throw Error('경로 데이터를 불러오지 못했어요.');return r.json();}).catch(err=>{network=null;throw err;});elevation??=fetch('/data/elevation-grid.json').then(r=>{if(!r.ok)throw Error();return r.json();}).catch(()=>{elevation=undefined;return null;});const [graph,grid]=await Promise.all([network,elevation]);graph.terrainExcludedWays=grid?.excludedWays;
 if(Array.isArray(legs)){
  // A leg the network cannot connect comes back as null so the caller can keep its own straight line.
  const paths=legs.map((leg:{from:[number,number];to:[number,number]})=>{
   try{return solveRoute(graph,leg.from,leg.to,prefs).coordinates;}catch{return null;}
  });
  self.postMessage({id,paths});return;
 }
 const result=solveRoute(graph,from,to,prefs);if(grid)result.elevation=routeElevation(result,grid);self.postMessage({id,result});}catch(error){self.postMessage({id,error:error instanceof Error?error.message:'경로를 계산하지 못했어요.'});}};
