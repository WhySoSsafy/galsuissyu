import test from 'node:test';import assert from 'node:assert/strict';import {handleTransit,normalizePaths} from '../server/transit.mjs';
const req=(path,body)=>new Request('http://localhost/api/transit/'+path,{method:'POST',body:JSON.stringify(body)});
const body={from:[127.434,36.332],to:[127.384,36.35],mode:'all'};
test('missing key returns explicit unavailable, no fabricated routes',async()=>{const r=await handleTransit(req('routes',body));assert.equal(r.status,503);assert.equal((await r.json()).code,'NOT_CONFIGURED');});
test('invalid and outside-city locations never call upstream',async()=>{let called=false;const r=await handleTransit(req('routes',{...body,from:[0,0]}),{ODSAY_API_KEY:'test'},async()=>{called=true;});assert.equal(r.status,400);assert.equal(called,false);});
test('normalizes walking, subway and bus without claiming accessibility',()=>{const paths=normalizePaths({result:{path:[{info:{totalTime:30,totalWalk:400,payment:1500,mapObj:'0:0@1:2:1:3'},subPath:[{trafficType:3,sectionTime:5,distance:400},{trafficType:1,lane:[{name:'1호선'}],startName:'대전역',endName:'시청역',startX:127.434,startY:36.332,endX:127.384,endY:36.35},{trafficType:2,lane:[{busNo:'101'}]}]}]}});assert.deepEqual(paths[0].legs.map(l=>l.mode),['walk','subway','bus']);assert.ok(paths[0].legs.every(l=>l.accessibility==='unknown'));assert.equal(paths[0].legs[0].from,null);});
test('empty and provider-error results differ',()=>{assert.deepEqual(normalizePaths({result:{path:[]}}),[]);assert.throws(()=>normalizePaths({error:{code:-99}}),/찾지 못/);assert.throws(()=>normalizePaths({}),/응답/);});
test('provider key stays in server request, domain credentials are attached, and neither leaks',async()=>{let upstream,options;const r=await handleTransit(req('routes',body),{ODSAY_API_KEY:'test-secret',ODSAY_SERVICE_URI:'example.test'},async(u,o)=>{upstream=u;options=o;return Response.json({result:{path:[]}});});assert.equal(upstream.searchParams.get('apiKey'),'test-secret');assert.equal(upstream.searchParams.get('SearchPathType'),'0');assert.equal(options.headers.Referer,'https://example.test/');assert.equal(options.headers.Origin,'https://example.test');const response=await r.text();assert.ok(!response.includes('test-secret'));assert.ok(!response.includes('example.test'));});
test('geometry preserves lane and section order, including a single-section mapObj',async()=>{let upstream;const r=await handleTransit(req('geometry',{mapObj:'30001:2:30104:30111'}),{ODSAY_API_KEY:'test'},async u=>{upstream=u;return Response.json({result:{lane:[{class:2,section:[{graphPos:[{x:127.4,y:36.3},{x:127.41,y:36.31}]},{graphPos:[{x:127.42,y:36.32},{x:127.43,y:36.33}]}]}]}});});const data=await r.json();assert.equal(upstream.searchParams.get('mapObject'),'0:0@30001:2:30104:30111');assert.equal(data.features.length,2);assert.deepEqual(data.features.map(f=>f.properties),[{mode:'subway',order:0,section:0},{mode:'subway',order:0,section:1}]);});
test('account-level failures arrive as an array and are named, not blamed on the route',()=>{
 try{normalizePaths({error:[{code:'429',message:'Daily quota exceeded'}]});assert.fail('should throw');}
 catch(e){assert.equal(e.code,'QUOTA');assert.equal(e.status,429);assert.match(e.message,/한도/);}
 try{normalizePaths({error:[{code:'401',message:'Unauthorized'}]});assert.fail('should throw');}
 catch(e){assert.equal(e.code,'AUTH');}
 // the object shape the provider uses for routing failures still reads the same way
 try{normalizePaths({error:{code:'-98'}});assert.fail('should throw');}
 catch(e){assert.equal(e.code,'-98');assert.match(e.message,/찾지 못/);}
});

test('a repeated search spends one upstream call, and a failure is never remembered',async()=>{
 let calls=0;
 const env={ODSAY_API_KEY:'test'};
 const ok=async()=>{calls++;return Response.json({result:{path:[{info:{totalTime:30,totalWalk:400,payment:1500,mapObj:'0:0@1:2:1:3'},subPath:[{trafficType:3,sectionTime:5,distance:400}]}]}});};
 const here={from:[127.4340001,36.3320001],to:[127.3849,36.3504],mode:'all'};
 assert.equal((await handleTransit(req('routes',here),env,ok)).status,200);
 assert.equal((await handleTransit(req('routes',here),env,ok)).status,200);
 assert.equal(calls,1,'the second identical search is answered from memory');

 // A different destination is a different question and must go upstream.
 await handleTransit(req('routes',{...here,to:[127.39,36.36]}),env,ok);
 assert.equal(calls,2);

 let quotaCalls=0;
 const quota=async()=>{quotaCalls++;return Response.json({error:[{code:'429',message:'Daily quota exceeded'}]});};
 const other={from:[127.44,36.34],to:[127.40,36.36],mode:'all'};
 const first=await handleTransit(req('routes',other),env,quota);
 assert.equal(first.status,429);
 const second=await handleTransit(req('routes',other),env,quota);
 assert.equal(second.status,429);
 assert.equal(quotaCalls,2,'a quota answer is not cached as if it were this route');
});
