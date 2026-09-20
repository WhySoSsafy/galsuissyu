import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundled=await build({entryPoints:['src/transit-simulation.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {transitPoint,transitStatus,nameWalkLegs,legSpan,withWalkPaths,walkLegEndpoints,travelledCoordinates}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const bus={id:'b',mode:'bus',line:'101',start:'A',end:'B',minutes:10,coordinates:[[127.38,36.35],[127.39,36.35]],startProgress:0,endProgress:.5};
const train={...bus,id:'t',mode:'subway',line:'1호선',startProgress:.5,endProgress:1,coordinates:[[127.39,36.35],[127.4,36.35]]};
const simulation={segments:[bus,train]};
test('boarding and alighting keep the vehicle stationary',()=>{
 assert.deepEqual(transitPoint(simulation,.02).coordinate,bus.coordinates[0]);
 assert.equal(transitPoint(simulation,.02).phase,'boarding');
 assert.deepEqual(transitPoint(simulation,.48).coordinate,bus.coordinates[1]);
 assert.equal(transitPoint(simulation,.48).phase,'alighting');
 assert.equal(transitPoint(simulation,.25).phase,'riding');
});
test('exact segment boundaries select the next vehicle, including after seeking',()=>{
 assert.equal(transitPoint(simulation,.5).segment.mode,'subway');
 assert.equal(transitPoint(simulation,.5).phase,'boarding');
 assert.equal(transitPoint(simulation,.25).segment.mode,'bus');
});
test('arrival clamps progress and restarting clears completion',()=>{
 assert.equal(transitPoint(simulation,1).phase,'arrived');
 assert.deepEqual(transitPoint(simulation,2).coordinate,train.coordinates[1]);
 assert.equal(transitPoint(simulation,0).phase,'boarding');
 assert.match(transitStatus(transitPoint(simulation,1)),/미리보기 완료/);
});

const leg=(mode,extra={})=>({mode,minutes:5,distance:null,start:null,end:null,line:'',direction:null,stops:null,from:null,to:null,accessibility:'unknown',...extra});

test('walk legs borrow the neighbouring stop names instead of a placeholder',()=>{
 const route={id:'0',minutes:33,walkDistance:480,fare:1550,mapObj:null,legs:[
  leg('walk'),
  leg('subway',{start:'대전역',end:'정부청사',line:'대전 1호선'}),
  leg('walk'),
  leg('bus',{start:'둔산경찰서',end:'스마트시티2단지',line:'3'}),
  leg('walk'),
 ]};
 const named=nameWalkLegs(route,'대전역 광장','한빛탑');
 assert.deepEqual(named.legs.map(l=>[l.start,l.end]),[
  ['대전역 광장','대전역'],
  ['대전역','정부청사'],
  ['정부청사','둔산경찰서'],
  ['둔산경찰서','스마트시티2단지'],
  ['스마트시티2단지','한빛탑'],
 ]);
 assert.equal(route.legs[0].start,null,'the original route object stays untouched');
});

test('a walk-only route falls back to the places the traveller picked',()=>{
 const named=nameWalkLegs({id:'0',minutes:9,walkDistance:600,fare:0,mapObj:null,legs:[leg('walk')]},'출발','도착');
 assert.deepEqual([named.legs[0].start,named.legs[0].end],['출발','도착']);
});

test('names already supplied by the provider are never overwritten',()=>{
 const named=nameWalkLegs({id:'0',minutes:9,walkDistance:600,fare:0,mapObj:null,legs:[leg('walk',{start:'제공된 출발',end:'제공된 도착'})]},'무시','무시');
 assert.deepEqual([named.legs[0].start,named.legs[0].end],['제공된 출발','제공된 도착']);
});

test('a walk bounded by one place reads as movement inside it, not a loop',()=>{
 assert.equal(legSpan('대전역','대전역'),'대전역 안에서 이동');
 assert.equal(legSpan('대전역','정부청사'),'대전역 → 정부청사');
 assert.equal(legSpan(null,'정부청사'),'구간 정보 미확인');
 assert.equal(legSpan('대전역',null),'구간 정보 미확인');
});

const walkSim={
 totalMinutes:20,
 segments:[
  {id:'w1',mode:'walk',line:'',start:'대전역',end:'대전역',minutes:5,coordinates:[[127.43,36.33],[127.44,36.34]],startProgress:0,endProgress:.25},
  {id:'b1',mode:'bus',line:'3',start:'대전역',end:'정부청사',minutes:10,coordinates:[[127.44,36.34],[127.40,36.36]],startProgress:.25,endProgress:.75},
  {id:'w2',mode:'walk',line:'',start:'정부청사',end:'한빛탑',minutes:5,coordinates:[[127.40,36.36],[127.39,36.37]],startProgress:.75,endProgress:1},
 ],
 coordinates:[],route:{legs:[]},
};

test('walk legs take the real footpath and the run is re-timed around it',()=>{
 const legs=walkLegEndpoints(walkSim);
 assert.deepEqual(legs,[
  {from:[127.43,36.33],to:[127.44,36.34]},
  {from:[127.40,36.36],to:[127.39,36.37]},
 ],'endpoints are handed over in walk order');
 const detour=[[127.43,36.33],[127.435,36.332],[127.44,36.34]];
 const out=withWalkPaths(walkSim,[detour,null]);
 assert.deepEqual(out.segments[0].coordinates,detour,'the routed path replaces the straight line');
 assert.deepEqual(out.segments[2].coordinates,walkSim.segments[2].coordinates,'an unroutable leg keeps its own line');
 assert.equal(out.segments[1].coordinates.length,2,'ride geometry is untouched');
 assert.equal(out.segments[0].minutes,5,"the provider's own timing is kept");
 const bounds=out.segments.map(s=>[s.startProgress,s.endProgress]);
 assert.equal(bounds[0][0],0);assert.equal(bounds.at(-1)[1],1);
 for(let i=1;i<bounds.length;i++)assert.equal(bounds[i][0],bounds[i-1][1],'progress stays continuous');
});

test('nothing changes when the walking network answers with nothing usable',()=>{
 assert.equal(withWalkPaths(walkSim,[null,null]),walkSim);
 assert.equal(withWalkPaths(walkSim,[[[127.43,36.33]],null]),walkSim,'a single point is not a path');
});

test('the travelled line grows with the run and never runs ahead of it',()=>{
 const start=travelledCoordinates(simulation,0);
 assert.ok(start.length===0||start.length===2,'nothing meaningful is drawn at the start');
 const mid=travelledCoordinates(simulation,.5);
 const late=travelledCoordinates(simulation,.9);
 assert.ok(late.length>=mid.length,'the line only grows');
 const here=transitPoint(simulation,.9).coordinate;
 assert.deepEqual(late.at(-1),here,'it ends exactly where the traveller is');
 const full=travelledCoordinates(simulation,1);
 assert.deepEqual(full.at(-1),transitPoint(simulation,1).coordinate);
});

// The camera turns to face travel. transitPoint gives heading as a maths angle (0 = east,
// anticlockwise); MapLibre wants a compass bearing (0 = north, clockwise). Getting the conversion
// wrong points the camera backwards, which is hard to spot and horrible to watch.
const compass=h=>(90-h*180/Math.PI+360)%360;

test('heading converts to a compass bearing that faces the direction of travel',()=>{
 const leg=(a,b)=>({id:'x',mode:'walk',line:'',start:null,end:null,minutes:1,coordinates:[a,b],startProgress:0,endProgress:1});
 const bearingFor=(a,b)=>compass(transitPoint({segments:[leg(a,b)]},.5).heading);
 const near=(got,want)=>assert.ok(Math.abs(((got-want+540)%360)-180)<1.5,`${got.toFixed(1)} should be about ${want}`);
 near(bearingFor([127.4,36.3],[127.5,36.3]),90);   // 동쪽
 near(bearingFor([127.4,36.3],[127.3,36.3]),270);  // 서쪽
 near(bearingFor([127.4,36.3],[127.4,36.4]),0);    // 북쪽
 near(bearingFor([127.4,36.3],[127.4,36.2]),180);  // 남쪽
});
