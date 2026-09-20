import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundled=await build({entryPoints:['src/transit-simulation.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {transitPoint,transitStatus,nameWalkLegs,legSpan}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
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
