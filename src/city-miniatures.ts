import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MercatorCoordinate,type Map as CityMap,type CustomLayerInterface} from 'maplibre-gl';
import {distance} from './city-data';
import {travelerModel} from './traveler-model';
import {facadeLayout} from './facade-layout';
import {loadScenery} from './static-scenery';
import type {RouteResult} from './route-engine';
import {hanbitLocation,hanbitTower,disposeLandmark} from './city-landmarks';
import {stationCrown,stationLocation,disposeStationCrown} from './station-landmark';
import {createPilotModels,type PilotLoadState} from './pilot-models';
import {architectureModels} from './architecture-models';
import {pilotStreets} from './pilot-streets';
import {bridgeModels} from './bridge-models';
import {loadMapContext} from './map-context';
import {groundHeight,horizontalDistance} from './terrain-placement';
export type MiniatureLayer=CustomLayerInterface & {pickAt:(point:{x:number;y:number})=>boolean};

/** Add architectural detail to the actual visible OSM footprints. Windows and planting
 * are explicitly procedural decoration, not surveyed façade/tree information. */
export function miniatureLayer(onDetail:(count:number)=>void,motion:()=>{route:RouteResult|null;playing:boolean;progress:number;wheelchair:boolean},onError:(cause:unknown)=>void,pilot:{selected:()=>string;onPick:(id:string)=>void;onState:(state:PilotLoadState)=>void}):MiniatureLayer{
 let map:CityMap,renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,origin:MercatorCoordinate;
 let treeCoordinates:number[][]=[];
 let details=new THREE.Group(),timer:ReturnType<typeof setTimeout>,treeSource:THREE.Group|undefined,removed=false,failed=false;
 const compact=window.innerWidth<740,buildingLimit=compact?50:85,windowLimit=compact?14000:26000,treeLimit=compact?70:120;
 const fail=(cause:unknown)=>{if(removed||failed)return;failed=true;onDetail(0);onError(cause);};
 const dummy=new THREE.Object3D(),traveler=new THREE.Group(),hanbit=hanbitTower(),station=stationCrown();let travelerSource:THREE.Group|undefined,travelerLoading=false;let avatar:ReturnType<typeof travelerModel>|undefined,avatarWheelchair:boolean|undefined;
 let pilotModels:ReturnType<typeof createPilotModels>|undefined;
 let architecture:ReturnType<typeof architectureModels>|undefined;
 let streets:ReturnType<typeof pilotStreets>|undefined;
 let bridges:ReturnType<typeof bridgeModels>|undefined;
 const bridgeRoute=new THREE.Group(),bridgeRouteMaterial=new THREE.MeshBasicMaterial({color:'#247c95'});
 function refreshBridgeRoute(){bridgeRoute.children.forEach(o=>(o as THREE.Mesh).geometry.dispose());bridgeRoute.clear();const route=motion().route;if(!route||map.getPitch()<10)return;for(const section of route.sections??[]){if(!section.kinds.includes('bridge'))continue;const points:THREE.Vector3[]=[];for(let i=1;i<section.coordinates.length;i++){const a=section.coordinates[i-1],b=section.coordinates[i],steps=Math.max(1,Math.ceil(distance(a,b)/10));for(let j=0;j<=steps;j++){const t=j/steps,p=local([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);p.z=(bridges?.heightAt(p,route.ways)??p.z)+.45;points.push(p);}}if(points.length>1){const curve=new THREE.CurvePath<THREE.Vector3>();for(let i=1;i<points.length;i++)if(points[i].distanceTo(points[i-1])>.01)curve.add(new THREE.LineCurve3(points[i-1],points[i]));if(curve.curves.length){const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(2,points.length*2),.65,4,false),bridgeRouteMaterial);mesh.frustumCulled=false;bridgeRoute.add(mesh);}}}}
 let motionRoute:RouteResult|null=null,progress=0,lastFrame=0,cumulative:number[]=[];
 const stone=new THREE.MeshStandardMaterial({color:'#f3ede1',roughness:.75}),glass=new THREE.MeshStandardMaterial({color:'#688c95',roughness:.28,metalness:.12}),roof=new THREE.MeshStandardMaterial({color:'#cec9bb',roughness:.8});
 function clear(){details.traverse(o=>{if((o as THREE.Mesh).isMesh)(o as THREE.Mesh).geometry.dispose();});scene.remove(details);details=new THREE.Group();scene.add(details);}
 function local(c:number[]):THREE.Vector3{const m=MercatorCoordinate.fromLngLat([c[0],c[1]]);const s=origin.meterInMercatorCoordinateUnits();return new THREE.Vector3((m.x-origin.x)/s,-(m.y-origin.y)/s,groundHeight(map,c)*m.meterInMercatorCoordinateUnits()/s);}
 function makeInstances(geometry:THREE.BufferGeometry,material:THREE.Material,matrices:THREE.Matrix4[]){if(!matrices.length){geometry.dispose();return;}const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;details.add(mesh);}
 function rebuild(){
  if(removed||failed||!map.getLayer('city-buildings'))return;
  origin=MercatorCoordinate.fromLngLat(map.getCenter());
  architecture?.refresh();pilotModels?.refresh();streets?.refresh();bridges?.refresh();refreshBridgeRoute();clear();if(map.getZoom()<16.2||map.getPitch()<10){onDetail(0);map.triggerRepaint();return;}
  const windows:THREE.Matrix4[]=[],frames:THREE.Matrix4[]=[],parapets:THREE.Matrix4[]=[];const seen=new Set();let count=0;
  const b=map.queryRenderedFeatures(undefined,{layers:['city-buildings']}).sort((a,b)=>Number(b.properties.h)-Number(a.properties.h));
  for(const f of b){if(f.id===469022520||pilotModels?.hasBuilding(f.id)||architecture?.hasBuilding(f.id)||seen.has(f.id)||count>=buildingLimit)continue;seen.add(f.id);if(f.geometry.type!=='Polygon'&&f.geometry.type!=='MultiPolygon')continue;
   const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;const height=Number(f.properties.h)||9;if(height<4)continue;let used=false;
   for(const rings of polys){const ring=rings[0].map(local);if(ring.length<4)continue;const cent=ring.reduce((a,p)=>a.add(p),new THREE.Vector3()).divideScalar(ring.length);if(horizontalDistance(cent)>500)continue;
    const signed=ring.reduce((n,p,i)=>{const q=ring[(i+1)%ring.length];return n+p.x*q.y-q.x*p.y;},0);
    for(let i=0;i<ring.length-1;i++){const a=ring[i],b=ring[i+1],len=Math.hypot(b.x-a.x,b.y-a.y);if(len<2.8||len>220)continue;const dx=(b.x-a.x)/len,dy=(b.y-a.y)/len,sign=signed>0?1:-1;const nx=dy*sign,ny=-dx*sign,angle=Math.atan2(dy,dx);const faceBudget=Math.max(1,Math.floor(windowLimit/buildingLimit/(ring.length-1)));const {bays,heights}=facadeLayout(height,len,faceBudget);
     dummy.position.set((a.x+b.x)/2,(a.y+b.y)/2,cent.z+height+.22);dummy.rotation.set(0,0,angle);dummy.scale.set(len,.22,.44);dummy.updateMatrix();parapets.push(dummy.matrix.clone());
     for(const z of heights)for(let j=0;j<bays;j++){if(windows.length>=windowLimit)break;const t=(j+.5)/bays;if(z+1>height)continue;const x=a.x+(b.x-a.x)*t+nx*.11,y=a.y+(b.y-a.y)*t+ny*.11;
      dummy.position.set(x,y,cent.z+z);dummy.scale.set(Math.min(1.5,len/bays*.6),.12,1.55);dummy.rotation.set(0,0,angle);dummy.updateMatrix();windows.push(dummy.matrix.clone());
      dummy.position.set(x-nx*.05,y-ny*.05,cent.z+z);dummy.scale.set(Math.min(1.5,len/bays*.6)+.18,.12,1.73);dummy.updateMatrix();frames.push(dummy.matrix.clone());
     }used=true;
    }
   }if(used)count++;
  }
  makeInstances(new THREE.BoxGeometry(1,1,1),stone,frames);makeInstances(new THREE.BoxGeometry(1,1,1),glass,windows);makeInstances(new THREE.BoxGeometry(1,1,1),roof,parapets);
  if(treeSource){
   const positions=treeCoordinates.filter(c=>Math.abs(c[0]-map.getCenter().lng)<.006&&Math.abs(c[1]-map.getCenter().lat)<.005).map(local).filter(p=>horizontalDistance(p)<550).sort((a,b)=>horizontalDistance(a)-horizontalDistance(b)).slice(0,treeLimit);
   const box=new THREE.Box3().setFromObject(treeSource),c=box.getCenter(new THREE.Vector3());const base=new THREE.Matrix4().makeRotationX(Math.PI/2).multiply(new THREE.Matrix4().makeTranslation(-c.x,-box.min.y,-c.z));
   treeSource.updateMatrixWorld(true);treeSource.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;const geometry=m.geometry.clone().applyMatrix4(m.matrixWorld).applyMatrix4(base);makeInstances(geometry,Array.isArray(m.material)?m.material[0]:m.material,positions.map(p=>new THREE.Matrix4().makeTranslation(p.x,p.y,p.z+.04)));});
  }
  onDetail(count);map.triggerRepaint();
 }
 function animateTraveler(){
  const state=motion(),now=performance.now();
  if(state.route!==motionRoute){motionRoute=state.route;refreshBridgeRoute();progress=0;cumulative=[0];if(motionRoute)for(let i=1;i<motionRoute.coordinates.length;i++)cumulative.push(cumulative[i-1]+distance(motionRoute.coordinates[i-1],motionRoute.coordinates[i]));}
  const total=cumulative.at(-1)||0;traveler.visible=!!motionRoute&&total>0;
  if(traveler.visible&&avatarWheelchair!==state.wheelchair){if(avatar){traveler.remove(avatar.root);avatar.dispose();}avatar=travelerModel(state.wheelchair);avatarWheelchair=state.wheelchair;traveler.add(avatar.root);}
  if(motionRoute&&total){
   progress=state.progress;
   const traveled=progress*total;let i=1;while(i<cumulative.length-1&&cumulative[i]<traveled)i++;
   const a=motionRoute.coordinates[i-1],b=motionRoute.coordinates[i],t=(traveled-cumulative[i-1])/(cumulative[i]-cumulative[i-1]||1);
   traveler.position.copy(local([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]));const bridgeSection=motionRoute.sections?.some(s=>s.kinds.includes('bridge')&&traveled>=s.startDistance&&traveled<=s.startDistance+s.distance);if(bridgeSection){const deck=bridges?.heightAt(traveler.position,motionRoute.ways);if(deck!==undefined)traveler.position.z=deck;}traveler.position.z+=.35;
   const d=local(b).sub(local(a)),target=Math.atan2(d.y,d.x)-Math.PI/2,delta=Math.atan2(Math.sin(target-traveler.rotation.z),Math.cos(target-traveler.rotation.z));
   traveler.rotation.z+=delta*Math.min(1,Math.max(.05,(now-lastFrame)/1000)*9);
   // The traveler is a readable map marker, deliberately larger than real people.
   // Compensate for zoom while keeping a bounded world size and natural gait.
   const metresPerPixel=40075016.686*Math.cos(map.getCenter().lat*Math.PI/180)/(512*2**map.getZoom());
   const markerScale=Math.min(75,Math.max(4,metresPerPixel*(compact?72:84)/1.7));
   traveler.scale.setScalar(markerScale);avatar?.animate(progress*total/markerScale,state.playing&&progress<1);
   if(state.playing||Math.abs(delta)>.01)map.triggerRepaint();
  }lastFrame=now;
 }
 let scheduled=false;
 const schedule=()=>{if(removed||failed||scheduled)return;scheduled=true;timer=setTimeout(()=>{scheduled=false;try{rebuild();}catch(cause){fail(cause);}},150);};
 return {pickAt(point){const id=pilotModels?.pick(point,camera);if(!id)return false;pilot.onPick(id);return true;},id:'architectural-details',type:'custom',renderingMode:'3d',onAdd(m,gl){map=m;try{scene=new THREE.Scene();camera=new THREE.Camera();scene.add(details);scene.add(bridgeRoute);scene.add(traveler);scene.add(hanbit);scene.add(station);origin=MercatorCoordinate.fromLngLat(map.getCenter());scene.add(new THREE.AmbientLight(0xffffff,1.5));const sun=new THREE.DirectionalLight(0xfff5df,2.1);sun.position.set(-150,-100,220);scene.add(sun);renderer=new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl,antialias:true});renderer.autoClear=false;architecture=architectureModels(map,scene,local,schedule);pilotModels=createPilotModels({map,scene,local,extraExcluded:()=>architecture?.excluded()??[],selected:pilot.selected,onState:pilot.onState,onChange:schedule});bridges=bridgeModels(map,scene,local,schedule);streets=pilotStreets(map,scene,local,schedule);pilotModels.refresh();renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NeutralToneMapping;map.on('moveend',schedule);map.on('sourcedata',schedule);map.on('terrain',schedule);Promise.all([loadScenery(),loadMapContext().catch(()=>null)]).then(([d,context])=>{if(!removed){treeCoordinates=[...d.trees,...(context?.features.filter(f=>f.geometry.type==='Point').map(f=>(f.geometry as GeoJSON.Point).coordinates)??[])];schedule();}}).catch(cause=>console.warn('[optional-scenery]',cause));new GLTFLoader().load('/models/pilot/tree.glb?v=foliage4',g=>{if(removed)return;treeSource=g.scene;schedule();},undefined,cause=>console.warn('[optional-tree]',cause));schedule();}catch(cause){fail(cause);}},render(gl,args){if(!renderer||failed)return;try{animateTraveler();streets?.animate();pilotModels?.updateSelection();hanbit.visible=map.getZoom()>=13;hanbit.position.copy(local(hanbitLocation));
   // The sign only earns its place once the building under it is readable.
   station.visible=map.getZoom()>=15.2;station.position.copy(local(stationLocation));const s=origin.meterInMercatorCoordinateUnits();const transform=new THREE.Matrix4().makeTranslation(origin.x,origin.y,origin.z).scale(new THREE.Vector3(s,-s,s));camera.projectionMatrix.fromArray(args.defaultProjectionData.mainMatrix).multiply(transform);renderer.resetState();renderer.render(scene,camera);}catch(cause){fail(cause);}},onRemove(){removed=true;bridgeRoute.children.forEach(o=>(o as THREE.Mesh).geometry.dispose());bridgeRouteMaterial.dispose();architecture?.dispose();bridges?.dispose();streets?.dispose();pilotModels?.dispose();clearTimeout(timer);map.off('moveend',schedule);map.off('sourcedata',schedule);map.off('terrain',schedule);clear();stone.dispose();glass.dispose();roof.dispose();treeSource?.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){m.geometry.dispose();(Array.isArray(m.material)?m.material:[m.material]).forEach(t=>t.dispose());}});travelerSource?.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){m.geometry.dispose();(Array.isArray(m.material)?m.material:[m.material]).forEach(t=>t.dispose());}});avatar?.dispose();disposeLandmark(hanbit);disposeStationCrown(station);renderer?.dispose();}};
}
