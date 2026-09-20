import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundled=await build({entryPoints:['src/tour-data.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {lowFloorBuses,toCityPlace}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));

const place=(publicTransport,rest={})=>({contentId:'1',name:'테스트',category:'관광지',contentTypeId:'12',address:'',lon:127.4,lat:36.3,image:'',thumbnail:'',tel:'',modifiedAt:'20250731144900',hours:'',restDay:'',parking:'',strollerNote:'',petNote:'',phone:'',ageRange:'',barrierFree:{getIn:{publicTransport},moveAround:null,vision:null,hearing:null,family:null},...rest});

test('only the routes on a line that says 저상 count as low-floor',()=>{
 assert.deepEqual(lowFloorBuses(place('대중교통 이용가능 : 스마트뷰아파트 정류장\n저상버스 운행 : 201, 501, 611, 615, 701번')),['201','501','611','615','701']);
 assert.deepEqual(lowFloorBuses(place('대중교통 이용 가능 : 삼성네거리 정류장\n저상버스 운행 : 201, 611, 613번\n지하철 :1호선 대전역(하차 시 약 10분 도보 위치)')),['201','611','613']);
});

test('ordinary bus numbers are never promoted to low-floor',()=>{
 assert.deepEqual(lowFloorBuses(place('5분거리 버스정류장에 705, 1001번 버스 하차')),[],'no 저상 on the line, so nothing is claimed');
 assert.deepEqual(lowFloorBuses(place('지하철 1호선 대전역 도보 5분')),[]);
 assert.deepEqual(lowFloorBuses({...place(''),barrierFree:null}),[]);
});

test('a barrier-free description never becomes a wheelchair verdict',()=>{
 const p=toCityPlace(place('저상버스 운행 : 201번'));
 assert.equal(p.wheelchair,'unknown','the text describes access, it does not rule on it');
 assert.equal(p.verified,true,'but it is a documented record');
 assert.ok(p.accessNotes.some(n=>n.includes('저상버스')),'the provider wording is carried through');
});

test('a place without coordinates is left out rather than placed at zero',()=>{
 assert.equal(toCityPlace({...place(''),lon:null,lat:null}),null);
});
