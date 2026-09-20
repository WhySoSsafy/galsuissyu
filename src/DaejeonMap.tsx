/// <reference types="vite/client" />
import {forwardRef,useEffect,useImperativeHandle,useMemo,useRef,useState} from 'react';
import {Map as MapLibreMap,Marker,Popup,ScaleControl,setWorkerUrl,type GeoJSONSource} from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import {CityFallback,type CityViewHandle} from './CityFallback';
import {cityBounds,categories,placeCoordinate,type CityPlace,type Coordinate} from './city-data';
import type {RouteResult} from './route-engine';
import type {MiniatureLayer} from './city-miniatures';
import type {PilotLoadState} from './pilot-models';
import {journeyLengths,journeyPoint} from './journey';
import {chooseMapPins} from './map-pins';
import {bridgeLayers} from './bridge-style';
import {loadMapContext} from './map-context';
import type {TransitSimulation} from './transit-types';
import {transitPoint,transitStatus} from './transit-simulation';
type Props={transitGeometry:GeoJSON.FeatureCollection<GeoJSON.LineString>|null;transitSimulation:TransitSimulation|null;transitPlaying:boolean;transitProgress:number;focusedPins:boolean;onEndpoint:(c:Coordinate,kind:'from'|'to')=>void;terrainStrength:number;onPilotState:(state:PilotLoadState)=>void;onPilotPick:(id:string)=>void;places:CityPlace[];selected:string;from:CityPlace|null;to:CityPlace|null;route:RouteResult|null;preview:boolean;progress:number;follow:boolean;wheelchair:boolean;onFollowChange:(v:boolean)=>void;onPick:(p:CityPlace)=>void;onPoint:(p:Coordinate)=>void;onDetail:(n:number)=>void;onZoom:(n:number)=>void;onCompatibility:(v:boolean)=>void};
export const DaejeonMap=forwardRef<CityViewHandle,Props>(function DaejeonMap(props,ref){
 const el=useRef<HTMLDivElement>(null),map=useRef<MapLibreMap|null>(null),fallback=useRef<CityViewHandle>(null),latest=useRef(props);latest.current=props;
 const [compat,setCompat]=useState(false),[ready,setReady]=useState(false),[tilesReady,setTilesReady]=useState(false),[error,setError]=useState(''),[fatal,setFatal]=useState(false),[attempt,setAttempt]=useState(0);const markers=useRef<Marker[]>([]),selection=useRef<Marker[]>([]);
 const lastView=useRef({center:(new URLSearchParams(location.search).has('pilot')?[127.434648,36.332246]:[127.3849,36.3504]) as Coordinate,zoom:16.6,pitch:52,bearing:-24});
 const lengths=useMemo(()=>journeyLengths(props.route?.coordinates??[]),[props.route]);
 const cameraTracking=useRef(false);
 const arrivalMarker=useRef<Marker|null>(null);
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const api=()=>({fly:(p:Coordinate,zoom=16.6,inset=0)=>{if(compat)fallback.current?.fly(p,zoom);else map.current?.flyTo({center:p,zoom,pitch:52,offset:window.innerWidth<=740?[0,-40]:[inset/2,0],duration:reduced()?0:1100});},overview:()=>{if(compat)fallback.current?.overview();else map.current?.fitBounds(cityBounds,{padding:45,pitch:0,bearing:0,duration:reduced()?0:1100});},zoom:(f:number)=>{if(compat)fallback.current?.zoom(f);else map.current?.zoomTo((map.current?.getZoom()??15)+Math.log2(f),{duration:200});},tilt:()=>{if(compat)return;const m=map.current!;m.easeTo({pitch:m.getPitch()>10?0:52,duration:reduced()?0:700});},fitRoute:(coords:Coordinate[])=>{if(compat){fallback.current?.fitRoute(coords);return;}if(!coords.length)return;const xs=coords.map(x=>x[0]),ys=coords.map(x=>x[1]);map.current?.fitBounds([[Math.min(...xs),Math.min(...ys)],[Math.max(...xs),Math.max(...ys)]],{padding:window.innerWidth<=740?{top:90,bottom:Math.min(window.innerHeight*.42,300),left:35,right:35}:80,maxZoom:17,pitch:40,duration:reduced()?0:1000});}});
 useImperativeHandle(ref,api,[compat]);
 useEffect(()=>{
  if(compat||!el.current)return;let m:MapLibreMap,disposed=false,styleLoaded=false,baseLoaded=false,detailsStarted=false,bridgesStarted=false;let pointPopup:Popup|undefined;let detailLayer:MiniatureLayer|undefined;let detailTimer:ReturnType<typeof setTimeout>|undefined;
  setReady(false);setTilesReady(false);setFatal(false);setError('');latest.current.onDetail(0);
  // MapLibre v6 ships its worker separately. Vite must bundle it explicitly.
  setWorkerUrl(new URL(mapWorkerUrl,window.location.href).href);
  try{m=new MapLibreMap({container:el.current,style:'/data/map-style.json',...lastView.current,minZoom:10,maxZoom:19.3,maxBounds:[[127.21,36.15],[127.58,36.535]],canvasContextAttributes:{antialias:true},pixelRatio:Math.min(window.devicePixelRatio||1,2),localIdeographFontFamily:'sans-serif',attributionControl:{compact:true},renderWorldCopies:false,transformRequest:url=>({url:new URL(url,window.location.href).href})});map.current=m;}
  catch(cause){console.error('[city-map] context initialization failed',cause);setCompat(true);latest.current.onCompatibility(true);return;}
  function reportDetailError(cause:unknown){if(disposed)return;console.error('[city-map] optional 3D detail failed',cause);setError('건물 세부 표현을 불러오지 못했어요. 기본 3D 지도와 검색은 계속 사용할 수 있어요.');}
  async function startBridges(){if(disposed||bridgesStarted)return;bridgesStarted=true;try{const response=await fetch('/data/bridges.json');if(!response.ok)throw Error(String(response.status));const data=await response.json();if(disposed)return;
   m.addSource('bridges',{type:'geojson',data});
   for(const layer of bridgeLayers)m.addLayer(layer,'city-rail');
  }catch(cause){console.warn('[city-map] optional bridge overlay failed',cause);}}
  function startDetails(){if(disposed||detailsStarted)return;detailsStarted=true;detailTimer=setTimeout(()=>{import('./city-miniatures').then(({miniatureLayer})=>{if(disposed)return;try{detailLayer=miniatureLayer(n=>latest.current.onDetail(n),()=>({route:latest.current.route,playing:latest.current.preview,progress:latest.current.progress,wheelchair:latest.current.wheelchair}),reportDetailError,{selected:()=>latest.current.selected,onPick:id=>latest.current.onPilotPick(id),onState:s=>latest.current.onPilotState(s)});m.addLayer(detailLayer,m.getLayer('journey-halo')?'journey-halo':undefined);}catch(cause){reportDetailError(cause);}}).catch(reportDetailError);import('./transit-vehicles').then(({transitVehicleLayer})=>{if(disposed)return;try{m.addLayer(transitVehicleLayer(()=>({simulation:latest.current.transitSimulation,playing:latest.current.transitPlaying,progress:latest.current.transitProgress,wheelchair:latest.current.wheelchair}),cause=>console.warn('[transit-vehicle]',cause)),m.getLayer('journey-halo')?'journey-halo':undefined);}catch(cause){console.warn('[transit-vehicle]',cause);}}).catch(cause=>console.warn('[transit-vehicle]',cause));},350);}
  const failed=()=>{console.error('[city-map] WebGL context lost');setCompat(true);latest.current.onCompatibility(true);};m.on('webglcontextlost',failed);
  m.on('sourcedata',e=>{if(e.sourceId==='daejeon'&&e.sourceDataType==='content'&&e.tile&&!baseLoaded){baseLoaded=true;setTilesReady(true);setFatal(false);setError('');startBridges();startDetails();}});
  m.on('style.load',()=>{
   styleLoaded=true;
   try{if(latest.current.terrainStrength>0)m.setTerrain({source:'terrain-dem',exaggeration:latest.current.terrainStrength});}catch{m.setTerrain(null);setError('입체 지형을 준비하지 못해 평면 지형으로 표시해요. 검색과 경로 안내는 계속 사용할 수 있어요.');}
   loadMapContext().then(data=>{if(disposed)return;m.addSource('station-context',{type:'geojson',data});m.addLayer({id:'station-context-surfaces',type:'fill',source:'station-context',filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':['match',['get','kind'],'garden','#acd17e','parking','#c3cfd5','#e0e4e7'],'fill-opacity':.95}},'road-casing');m.addLayer({id:'station-context-edges',type:'line',source:'station-context',filter:['==',['geometry-type'],'Polygon'],minzoom:16,paint:{'line-color':'#f9fcff','line-width':1.5}},'road-casing');}).catch(cause=>console.warn('[station-context]',cause));
   // Release the blocking screen before any optional 3D work is attempted.
   setReady(true);latest.current.onZoom(m.getZoom());startDetails();
   try{
   m.addSource('journey',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
   m.addLayer({id:'journey-halo',type:'line',source:'journey',filter:['==',['get','part'],'path'],paint:{'line-color':'#ffffff','line-width':10},layout:{'line-cap':'round','line-join':'round'}});
   m.addLayer({id:'journey-path',type:'line',source:'journey',filter:['==',['get','part'],'path'],paint:{'line-color':['match',['get','slope'],'up','#b08a59','down','#8587af','level','#61988d','unknown','#99a2a2','#dc7756'],'line-width':5},layout:{'line-cap':'round','line-join':'round'}});
   m.addSource('journey-progress',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
   m.addLayer({id:'journey-progress-line',type:'line',source:'journey-progress',paint:{'line-color':'#247c95','line-width':6},layout:{'line-cap':'round','line-join':'round'}});
   m.addLayer({id:'journey-connection',type:'line',source:'journey',filter:['==',['get','part'],'connection'],paint:{'line-color':'#b8895e','line-width':4,'line-dasharray':[2,2]}});
   }catch(cause){console.error('[city-map] route overlay initialization failed',cause);setError('동선 표시를 준비하지 못했어요. 지도를 다시 불러와 주세요.');}
  });
  const resize=new ResizeObserver(()=>m.resize());resize.observe(el.current!);
  m.on('dragstart',()=>latest.current.onFollowChange(false));
  m.on('zoomstart',e=>{if(e.originalEvent)latest.current.onFollowChange(false);});
  m.on('rotatestart',e=>{if(e.originalEvent)latest.current.onFollowChange(false);});
  m.on('zoomend',()=>latest.current.onZoom(m.getZoom()));
  m.on('error',e=>{console.error('[city-map] resource error',e.error);if(!styleLoaded){setFatal(true);setError('지도를 불러오지 못했어요. 다시 불러오거나 2D 호환 지도를 이용해 주세요.');return;}if(baseLoaded)setError('일부 지도 자료를 불러오지 못했어요. 기본 지도는 계속 사용할 수 있어요.');});
  m.on('click',e=>{pointPopup?.remove();if(detailLayer?.pickAt(e.point))return;const c:Coordinate=[e.lngLat.lng,e.lngLat.lat],box=document.createElement('div');box.className='map-point-actions';const title=document.createElement('strong');title.textContent='이 위치에서';box.append(title);for(const [kind,label] of [['from','출발'],['to','도착']] as const){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{latest.current.onEndpoint(c,kind);pointPopup?.remove();};box.append(b);}pointPopup=new Popup({offset:10,closeButton:true,maxWidth:'260px',focusAfterOpen:true}).setLngLat(c).setDOMContent(box).addTo(m);});
  m.addControl(new ScaleControl({maxWidth:100,unit:'metric'}),'bottom-left');
  return()=>{disposed=true;pointPopup?.remove();resize.disconnect();clearTimeout(detailTimer);markers.current.forEach(x=>x.remove());selection.current.forEach(x=>x.remove());lastView.current={center:m.getCenter().toArray(),zoom:m.getZoom(),pitch:m.getPitch(),bearing:m.getBearing()};m.remove();map.current=null;};
 },[attempt,compat]);
 useEffect(()=>{
  if(!ready||!map.current||compat)return;const m=map.current;markers.current.forEach(x=>x.remove());markers.current=[];
  function refresh(){if(cameraTracking.current)return;markers.current.forEach(x=>x.remove());markers.current=[];const bounds=m.getBounds(),state=latest.current;
   const chosen=chooseMapPins(state.places,{selected:state.selected,from:state.from,to:state.to,focused:state.focusedPins,route:!!state.route||!!state.transitSimulation,zoom:m.getZoom(),width:m.getContainer().clientWidth,height:m.getContainer().clientHeight,project:p=>m.project([p.lon,p.lat]),contains:p=>bounds.contains([p.lon,p.lat])});
   for(const p of chosen){const c=categories[p.category]||categories.public;const button=document.createElement('button');button.type='button';button.className='city-map-pin'+(p.id===latest.current.selected?' selected':'');button.style.setProperty('--pin',c.color);button.setAttribute('aria-label',p.name);button.title=p.name;
    const icon=document.createElement('span');icon.textContent=c.icon;button.append(icon);{const label=document.createElement('b');label.textContent=p.name;button.append(label);}button.addEventListener('click',e=>{e.stopPropagation();latest.current.onPick(p);});markers.current.push(new Marker({element:button,anchor:'bottom'}).setLngLat([p.lon,p.lat]).addTo(m));
   }
  }refresh();m.on('moveend',refresh);return()=>{m.off('moveend',refresh);markers.current.forEach(x=>x.remove());};
 },[ready,props.places,props.selected,props.from,props.to,props.focusedPins,props.route,props.transitSimulation,props.follow,compat]);
 useEffect(()=>{if(!ready||!map.current||compat)return;const m=map.current;const data=props.transitGeometry??{type:'FeatureCollection',features:[]};if(!m.getSource('transit-route')){m.addSource('transit-route',{type:'geojson',data});m.addLayer({id:'transit-route-halo',source:'transit-route',type:'line',paint:{'line-color':'#fff','line-width':9}});m.addLayer({id:'transit-route-lines',source:'transit-route',type:'line',filter:['!=',['get','mode'],'walk'],paint:{'line-color':['match',['get','mode'],'subway','#7855b7','#267ba3'],'line-width':5},layout:{'line-cap':'round','line-join':'round'}});m.addLayer({id:'transit-walk-lines',source:'transit-route',type:'line',filter:['==',['get','mode'],'walk'],paint:{'line-color':'#a66a55','line-width':4,'line-dasharray':[2,2]},layout:{'line-cap':'round','line-join':'round'}});}else (m.getSource('transit-route') as GeoJSONSource).setData(data);},[ready,compat,props.transitGeometry]);
 useEffect(()=>{if(!ready||!map.current||compat)return;selection.current.forEach(m=>m.remove());selection.current=[];for(const [p,label,color] of [[props.from,'출발','#28485b'],[props.to,'도착','#ce6b51']] as const){if(!p)continue;const b=document.createElement('button');b.className='endpoint-pin';b.style.background=color;b.textContent=label;b.setAttribute('aria-label',label+' '+p.name);b.onclick=e=>{e.stopPropagation();latest.current.onPick(p);};selection.current.push(new Marker({element:b,anchor:'bottom'}).setLngLat(placeCoordinate(p)).addTo(map.current));}},[ready,props.from,props.to,compat]);
 useEffect(()=>{if(!ready||!map.current||compat)return;const source=map.current.getSource('journey') as GeoJSONSource|undefined;if(!source)return;const features:GeoJSON.Feature[]=[];if(props.route){if(props.route.elevation?.segments.length){for(const s of props.route.elevation.segments)features.push({type:'Feature',properties:{part:'path',slope:s.kind},geometry:{type:'LineString',coordinates:s.coordinates}});}else features.push({type:'Feature',properties:{part:'path'},geometry:{type:'LineString',coordinates:props.route.coordinates}});for(const c of props.route.connectors)features.push({type:'Feature',properties:{part:'connection'},geometry:{type:'LineString',coordinates:c}});}source.setData({type:'FeatureCollection',features});if(!props.route)(map.current.getSource('journey-progress') as GeoJSONSource|undefined)?.setData({type:'FeatureCollection',features:[]});},[ready,props.route,compat]);
 useEffect(()=>{if(!ready||compat||!map.current)return;try{map.current.setTerrain(props.terrainStrength>0?{source:'terrain-dem',exaggeration:props.terrainStrength}:null);}catch{map.current.setTerrain(null);setError('입체 지형을 준비하지 못해 평면 지형으로 표시해요.');}},[ready,compat,props.terrainStrength]);
 useEffect(()=>{map.current?.triggerRepaint();},[props.preview,props.progress,props.route,props.selected,props.transitPlaying,props.transitProgress,props.transitSimulation]);
  // The leg label stays pinned to the viewport. Chasing the model made the text shake with the camera.
 const transitBanner=useMemo(()=>{
  if(compat||!props.transitSimulation)return null;
  const p=transitPoint(props.transitSimulation,props.transitProgress);
  if(p.phase==='arrived')return null;
  return {text:transitStatus(p),className:'transit-status-banner mode-'+p.segment.mode+' phase-'+p.phase};
 },[compat,props.transitSimulation,props.transitProgress]);
 const arrived=!!((props.route&&props.progress>=1)||(props.transitSimulation&&props.transitProgress>=1));
 useEffect(()=>{
  if(!ready||compat||!map.current||!arrived)return;
  const coordinate=props.transitSimulation?.coordinates.at(-1)??props.route?.coordinates.at(-1);if(!coordinate)return;
  const badge=document.createElement('div');badge.className='arrival-map-marker';badge.setAttribute('aria-label','목적지 도착 · 시뮬레이션 완료');
  const pulse=document.createElement('span');pulse.className='arrival-map-pulse';const check=document.createElement('b');check.textContent='✓';badge.append(pulse,check);
  arrivalMarker.current=new Marker({element:badge,anchor:'center'}).setLngLat(coordinate).addTo(map.current);
  return()=>{arrivalMarker.current?.remove();arrivalMarker.current=null;};
 },[arrived,ready,compat,props.route,props.transitSimulation]);
 useEffect(()=>{
  if(!ready||!map.current||compat||!props.route)return;
  const m=map.current,labels={steps:'계단',rough:'거친 노면',steep:'급경사',bridge:'다리'},pins:Marker[]=[];
  for(const [i,section] of (props.route.sections??[]).slice(0,6).entries()){
   const p=section.coordinates[Math.floor(section.coordinates.length/2)];if(!p)continue;
   const button=document.createElement('button');button.type='button';button.className='travel-checkpoint-pin';button.textContent=String(i+1);
   button.setAttribute('aria-label',`확인 구간 ${i+1}: ${section.kinds.map(k=>labels[k]).join(', ')}. 확대해서 보기`);button.title=section.kinds.map(k=>labels[k]).join(' · ');
   button.onclick=e=>{e.stopPropagation();api().fitRoute(section.coordinates);};pins.push(new Marker({element:button,anchor:'center'}).setLngLat(p).addTo(m));
  }
  return()=>pins.forEach(p=>p.remove());
 },[ready,compat,props.route]);
 useEffect(()=>{
  const m=map.current;if(!ready||!m||compat||!props.route)return;
  const coords=props.route.coordinates,point=journeyPoint(coords,lengths,props.progress);
  const traveled=[...coords.slice(0,point.index),point.coordinate];
  const source=m.getSource('journey-progress') as GeoJSONSource|undefined;
  source?.setData({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:traveled}});
 },[ready,compat,props.progress,props.follow,props.route]);
 // A single frame loop follows the latest target; never restart an easeTo every 450ms.
 useEffect(()=>{
  const m=map.current;if(!ready||!m||compat||!props.follow||(!props.route&&!props.transitSimulation))return;
  let frame=0,previous=performance.now();const routeLengths=journeyLengths(props.route?.coordinates??[]);
  m.stop();cameraTracking.current=true;
  // Cut to the first target rather than sweeping there. Blending across kilometres while holding
  // street-level zoom outruns tile loading, so the viewport renders as bare background the whole way.
  const s0=latest.current,startZoom=s0.transitSimulation?16.8:17;
  const start=s0.transitSimulation?transitPoint(s0.transitSimulation,s0.transitProgress).coordinate:s0.route?journeyPoint(s0.route.coordinates,routeLengths,s0.progress).coordinate:null;
  if(start){const c=m.getCenter();if(Math.abs(c.lng-start[0])>.004||Math.abs(c.lat-start[1])>.004)m.jumpTo({center:start,zoom:Math.max(m.getZoom(),startZoom),pitch:55});}
  const tick=(now:number)=>{
   const s=latest.current;if(!s.follow)return;
   const coordinate=s.transitSimulation?transitPoint(s.transitSimulation,s.transitProgress).coordinate:s.route?journeyPoint(s.route.coordinates,routeLengths,s.progress).coordinate:null;
   if(!coordinate)return;
   const dt=Math.min(.05,Math.max(0,(now-previous)/1000));previous=now;
   const center=m.getCenter(),blend=reduced()?1:1-Math.exp(-dt*8);
   const lon=center.lng+(coordinate[0]-center.lng)*blend,lat=center.lat+(coordinate[1]-center.lat)*blend;
   const targetZoom=s.transitSimulation?16.8:17,zoom=m.getZoom(),pitch=m.getPitch();
   if(Math.abs(lon-center.lng)+Math.abs(lat-center.lat)>1e-9||pitch<54.99||zoom<targetZoom-.001)
    m.jumpTo({center:[lon,lat],pitch:pitch+(55-pitch)*blend,zoom:zoom<targetZoom?zoom+(targetZoom-zoom)*blend:zoom});
   frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);
  return()=>{cancelAnimationFrame(frame);cameraTracking.current=false;};
 },[ready,compat,props.follow,props.route,props.transitSimulation]);
 const retry=()=>{setReady(false);setTilesReady(false);setFatal(false);setError('');setAttempt(n=>n+1);};
 return <>{compat?<CityFallback ref={fallback} {...props}/>:<div className="daejeon-canvas" ref={el} aria-label="대전 전역 3D 지도"/>}{!compat&&!ready&&!fatal&&<div className="map-loading"><span className="scene-spinner"/>대전 지도를 준비하고 있어요…</div>}{!compat&&ready&&!tilesReady&&!fatal&&<div className="map-tile-loading" role="status">주변 도로와 건물을 불러오고 있어요…</div>}{transitBanner&&<div className={transitBanner.className} role="status" aria-live="polite">{transitBanner.text}</div>}{!compat&&error&&<div className={'map-data-error '+(fatal?'map-fatal-error':'')} role="status"><span>{error}</span><div className="map-recovery-actions"><button onClick={retry}>다시 불러오기</button>{fatal&&<button onClick={()=>{setCompat(true);latest.current.onCompatibility(true);}}>2D 호환 지도</button>}{!fatal&&<button onClick={()=>setError('')} aria-label="알림 닫기">×</button>}</div></div>}</>;
});
