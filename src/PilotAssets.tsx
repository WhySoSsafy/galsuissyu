import {useRef,useState} from 'react';
import {SceneCanvas,type SceneHandle} from './SceneCanvas';
import {pilotAssets,type PilotAssetId} from './pilot-data';
import './scene.css';
import './asset-workspace.css';
import {tourismAssets,tourismProject} from './tourism-assets';

export default function PilotAssets({initial='station',onBack,onLegacy,onPlace}:{initial?:PilotAssetId;onBack:()=>void;onLegacy:()=>void;onPlace:(asset:PilotAssetId)=>void}){
 const [selected,setSelected]=useState<PilotAssetId>(initial),[category,setCategory]=useState('전체'),[ready,setReady]=useState(false),[sheet,setSheet]=useState(false);
 const canvas=useRef<SceneHandle>(null);const asset=pilotAssets.find(a=>a.id===selected)!;
 const tourism=tourismAssets.find(a=>a.id===selected);
 const [panelOpen,setPanelOpen]=useState(true);
 const [search,setSearch]=useState(''),[district,setDistrict]=useState('전체 지역');
 const visible=pilotAssets.filter(a=>(category==='전체'||a.group===category)&&a.name.includes(search.trim())&&(district==='전체 지역'||tourismAssets.some(t=>t.id===a.id&&t.district.includes(district))));
 return <div className={'city-app asset-workspace'+(panelOpen?'':' panel-collapsed')}>
  <header className="dj-header"><button className="dj-brand" onClick={onBack}><img src="/brand/mark-128.png" alt=""/><strong>갈수있슈<small>나에게 맞는 대전 여행길</small></strong></button><div className="dj-location"><i/>대전광역시 <span>3D 모형</span></div><button className="dj-profile" onClick={onBack}>← 지도로 돌아가기</button></header>
  <main className="city-layout"><nav className="desktop-rail" aria-label="지도 도구"><button onClick={()=>setPanelOpen(!panelOpen)} aria-expanded={panelOpen} aria-controls="asset-sidebar"><span>☰</span>메뉴</button><button onClick={onBack}><span>⌖</span>탐색</button><button aria-current="page"><span>◇</span>3D 모형</button></nav><aside id="asset-sidebar" className={'city-panel '+(sheet?'expanded':'')} aria-label="3D 모형 목록">
   <button className="city-sheet-handle" onClick={()=>setSheet(!sheet)} aria-expanded={sheet}>{sheet?'접기 ↓':'에셋 선택하기 ↑'}</button><div className="city-panel-scroll">
    <div className="city-intro"><span className="city-eyebrow">관광지 모형 {tourismAssets.length}종 · 편의시설 모형</span><h1>3D 모형</h1><p>공원과 숲, 박물관과 문화유산까지.<br/>모형을 돌리고 확대하며 살펴보세요.</p></div>
    <div className="tourism-search"><label>모형 검색<input type="search" placeholder="관광지 이름 검색" value={search} onChange={e=>setSearch(e.target.value)}/></label><label>지역<select value={district} onChange={e=>setDistrict(e.target.value)}>{['전체 지역','동구','중구','서구','유성구','대덕구'].map(d=><option key={d}>{d}</option>)}</select></label></div>
    <div className="city-section-title"><h2>모형 목록</h2><span aria-live="polite">{visible.length} / {pilotAssets.length}종</span></div>
    {visible.length===0&&<p role="status">일치하는 모형이 없어요. 검색어나 지역을 바꿔보세요.</p>}
    <div className="city-filters" aria-label="에셋 종류">{['전체','관광지','건축 모듈','장소','시설','사람·교통','길·풍경'].map(c=><button key={c} aria-pressed={category===c} className={category===c?'chosen':''} onClick={()=>setCategory(c)}>{c}</button>)}</div>
    <div className="city-asset-grid">{visible.map(a=><button key={a.id} className={'city-asset '+(selected===a.id?'chosen':'')} aria-pressed={selected===a.id} onClick={()=>{if(selected!==a.id)setReady(false);setSelected(a.id);setSheet(false);}}><span className="city-asset-icon">{a.icon}</span><span><strong>{a.name}</strong><small>{a.group}</small></span></button>)}</div>
    <article className="city-detail"><div><span>{asset.group}</span></div><h2>{asset.name}</h2><p>{['metro-train','metro-entrance','metro-lift'].includes(selected)?'힉스필드에서 제작한 지하철 공통 모듈이에요. 실제 대전 차량 외관이나 특정 역의 출입구를 실측한 모형이 아니며, 지도 배치·열차 시뮬레이션은 아직 연결하지 않았어요.':selected==='tour-expo-bridge'?'실제 교량 선형에 맞춰 지도에 배치했어요. 폭·아치 높이는 시각적 재구성이며 실측값이 아니에요.':tourism?'힉스필드에서 제작한 장소별 해석 모형이에요. 실제 치수와 출입구는 미검증 상태이며 지도 배치는 아직 적용하지 않았어요.':['shop','midrise','highrise'].includes(selected)?'공통 건축 모듈이에요. 실제 건물의 외관을 그대로 복제한 것은 아니며, 지도에서는 원본 위치와 높이에 맞춰 사용해요.':selected==='metro'?'중앙로역과 연결된 출입구 표현용 모형이에요. 개별 출입구 위치는 아직 확인되지 않았어요.':['station','bakery'].includes(selected)?'공개 지도 위치에 연결된 외관 모형이에요. 건물의 세부 형태와 높이는 재구성했어요.':'시설과 이동 상황을 표현하기 위한 모형이에요. 실제 설치 위치나 운영 상태를 뜻하지 않아요.'}</p>{tourism&&<div className="tourism-model-info"><p><strong>{tourism.district}</strong><br/>{tourism.feature}</p><a href={'https://daejeontour.co.kr/sights_djt?page='+tourism.page} target="_blank" rel="noreferrer">대전관광 명소 안내 ↗</a><a href={tourismProject} target="_blank" rel="noreferrer">힉스필드 제작 장면 ↗</a><a href={'/models/tourism/'+selected.slice(5)+'.glb'} download>이 모형 다운로드 ↓</a></div>}{['station','bakery','metro','tour-expo-bridge'].includes(selected)&&<button onClick={()=>onPlace(selected)}>지도에서 이 장소 보기 ↗</button>}</article>
    <button className="dj-text-button" onClick={onLegacy}>이전 미니어처와 움직임 보기 ↗</button>
   </div></aside>
   <section className="city-stage" aria-label="개별 3D 에셋"><button className="sidebar-toggle" aria-controls="asset-sidebar" aria-expanded={panelOpen} aria-label={panelOpen?'모형 목록 접기':'모형 목록 펼치기'} onClick={()=>setPanelOpen(!panelOpen)}>{panelOpen?'‹':'›'}</button><SceneCanvas ref={canvas} url={tourism?'/models/tourism/'+selected.slice(5)+'.glb':'/models/pilot/'+selected+'.glb'} isolated playing={false} routeVisible={false} onPick={()=>{}} onTime={()=>{}} onReady={setReady}/>
    <div className="city-stage-heading"><span className="city-badge">{asset.group}</span><h2>{asset.name}</h2><p>드래그하여 회전 · 두 손가락으로 확대</p></div>
    <div className="city-controls"><button disabled={!ready} aria-label="에셋 확대" onClick={()=>canvas.current?.zoom(1.25)}>＋</button><button disabled={!ready} aria-label="에셋 축소" onClick={()=>canvas.current?.zoom(.8)}>−</button><button disabled={!ready} aria-label="에셋 시점 초기화" onClick={()=>canvas.current?.reset()}>⌖</button></div>
    <div className="city-model-note"><span>외관을 재구성한 3D 모형</span><p>{tourism?'장소 특징을 축약한 해석 모형 · 실제 외관·출입구 추가 검증 필요':'이용 가능 여부는 장소 정보에서 확인해 주세요.'}</p></div>
   </section></main>
 </div>;
}
