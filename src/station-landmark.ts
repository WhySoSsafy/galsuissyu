import * as THREE from 'three';

/** The building's own placement, shared with pilotMapModels so the sign lands square on its front. */
export const stationLocation:[number,number]=[127.4346489288,36.3321739694];
export const stationAngle=21.31;          // radians, as the placement uses it: ≈141°
export const STATION_FRONT_BEARING=39;    // where the face carrying the name looks
export const STATION_VIEW_BEARING=219;    // so the camera meets it head on from the opposite side

// Korean glyphs are not in any typeface bundle small enough to ship, so the sign is drawn once into
// a canvas and used as a texture. It stays crisp because the canvas is sized for the zoom the
// opening view sits at, and it costs one draw rather than a font parse.
function signTexture(text:string,{color='#1b56a4',width=1024,height=420}={}){
 const canvas=document.createElement('canvas');
 canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');
 if(!ctx)return null;
 ctx.clearRect(0,0,width,height);
 ctx.font=`900 ${Math.round(height*0.66)}px "Noto Sans KR","Malgun Gothic",sans-serif`;
 ctx.textAlign='center';ctx.textBaseline='middle';
 // The letters are spaced the way a station sign spaces them: 대 전 역, not 대전역.
 const spaced=[...text].join('  ');
 ctx.fillStyle=color;
 ctx.fillText(spaced,width/2,height/2+height*0.02);
 const texture=new THREE.CanvasTexture(canvas);
 texture.anisotropy=8;
 texture.colorSpace=THREE.SRGBColorSpace;
 return texture;
}

/**
 * What is added on top of the station model: the name across its front and the canopy under it.
 * Stylised, like every other model here — the shape of a building is not evidence about getting
 * into it.
 */
export function stationCrown(){
 const group=new THREE.Group();
 group.name='대전역 · 사인과 부속 구조';
 group.rotation.z=stationAngle;   // the building's own rotation, so the sign sits flat on its face

 const concrete=new THREE.MeshStandardMaterial({color:'#e7e3d8',roughness:.72});
 const metal=new THREE.MeshStandardMaterial({color:'#cfd4d6',roughness:.36,metalness:.4});

 // In group space the front face looks along -y, so everything that belongs on the front is at
 // negative y. The model is 170m long, 92m deep, 18m tall.
 const FRONT=-45, TOP=18;

 // ── The name. A recessed panel behind it so the letters read against the sky as well as the wall.
 const backing=new THREE.Mesh(new THREE.BoxGeometry(46,1.4,11),concrete);
 backing.position.set(-6,FRONT-0.9,TOP+5.4);
 group.add(backing);

 const texture=signTexture('대전역');
 if(texture){
  const sign=new THREE.Mesh(
   new THREE.PlaneGeometry(42,9),
   new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}),
  );
  sign.rotation.x=Math.PI/2;                 // upright, facing -y
  sign.position.set(-6,FRONT-1.7,TOP+5.4);
  group.add(sign);
 }

 // A slim cap over the panel, the way a station parapet finishes.
 const cap=new THREE.Mesh(new THREE.BoxGeometry(48,2.6,.7),metal);
 cap.position.set(-6,FRONT-1.2,TOP+11.1);
 group.add(cap);

 // ── A slim canopy at the doors. The model already carries its own frontage, so this only adds
 // the line of shelter under the name; anything more fought with the geometry underneath it.
 const canopy=new THREE.Mesh(new THREE.BoxGeometry(54,7,.8),metal);
 canopy.position.set(-6,FRONT-3.4,8.6);
 group.add(canopy);
 for(let i=0;i<6;i++){
  const column=new THREE.Mesh(new THREE.CylinderGeometry(.42,.52,8.6,10),metal);
  column.rotation.x=Math.PI/2;
  column.position.set(-30+i*9.6,FRONT-6.4,4.3);
  group.add(column);
 }

 return group;
}

export function disposeStationCrown(group:THREE.Group){
 const materials=new Set<THREE.Material>();
 group.traverse(o=>{
  const mesh=o as THREE.Mesh;
  if(!mesh.isMesh)return;
  mesh.geometry.dispose();
  (Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(m=>materials.add(m));
 });
 materials.forEach(m=>{
  const withMap=m as THREE.MeshBasicMaterial;
  withMap.map?.dispose();
  m.dispose();
 });
}
