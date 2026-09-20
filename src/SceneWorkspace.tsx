import {useRef,useState,useEffect} from 'react';
import {SceneCanvas,type SceneHandle} from './SceneCanvas';
import {sceneAssets} from './scene-assets';
import './scene.css';

export default function SceneWorkspace({onPlaces}:{onPlaces:()=>void}){
 const canvas=useRef<SceneHandle>(null);
 const [selected,setSelected]=useState('BL01'),[isolated,setIsolated]=useState(false),[playing,setPlaying]=useState(false),[ready,setReady]=useState(false),[route,setRoute]=useState(true),[sheet,setSheet]=useState(false);
 const [time,setTime]=useState(0),[duration,setDuration]=useState(64),[category,setCategory]=useState('전체');
 const asset=sceneAssets.find(a=>a.id===selected)!;
 const visible=sceneAssets.filter(a=>category==='전체'||(category==='사람·교통'?['여행자','교통'].includes(a.group):category==='시설'?['이동 시설','장소','쉼터'].includes(a.group):['길','풍경'].includes(a.group)));
 useEffect(()=>{const mq=matchMedia('(prefers-reduced-motion: reduce)');setPlaying(!mq.matches);const update=()=>{if(mq.matches)setPlaying(false);};mq.addEventListener('change',update);return()=>mq.removeEventListener('change',update);},[]);
 function pick(id:string){setSelected(id);if(isolated)setPlaying(false);}
 function changeMode(value:boolean){setIsolated(value);setPlaying(false);setTime(0);}
 const stage=time<6?'버스가 정류장으로 이동해요':time<21?'휠체어 여행자가 횡단 구간을 지나가요':time<31?'공원 길을 따라 이동해요':time<41?'잠시 둘러보고 돌아가요':'광장으로 돌아오는 길이에요';
 return <div className="city-app">
  <header className="city-header"><a href="/" className="city-brand"><img src="/brand/mark-128.png" alt=""/><strong>갈수있슈<span>모두의 이동을 위한 지도</span></strong></a><nav aria-label="화면 선택"><button className="chosen" aria-current="page">3D 둘러보기</button><button onClick={onPlaces}>대전 장소·길찾기 ↗</button></nav><span className="city-region">대전 <span>·</span> 미니어처 작업 공간</span></header>
  <main className="city-layout">
   <aside className={'city-panel '+(sheet?'expanded':'')} aria-label="3D 부품 살펴보기">
    <button className="city-sheet-handle" onClick={()=>setSheet(!sheet)} aria-expanded={sheet}>{sheet?'접기 ↓':'부품과 상세 정보 보기 ↑'}</button>
    <div className="city-panel-scroll">
     <div className="city-intro"><span className="city-eyebrow">갈수있슈 · 대전 미니어처</span><h1>직접 둘러볼까유?</h1><p>작은 도시를 돌려 보고,<br/>길과 시설을 하나씩 살펴보세요.</p></div>
     <div className="city-modes" role="group" aria-label="보기 방식"><button aria-pressed={!isolated} className={!isolated?'chosen':''} onClick={()=>changeMode(false)}>도시 전체</button><button aria-pressed={isolated} className={isolated?'chosen':''} onClick={()=>changeMode(true)}>부품 하나씩</button></div>
     <div className="city-section-title"><h2>도시를 구성하는 것들</h2><span>12종</span></div>
     <div className="city-filters" role="group" aria-label="부품 종류">{['전체','사람·교통','시설','길·풍경'].map(c=><button key={c} className={category===c?'chosen':''} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}</div>
     <div className="city-asset-grid">{visible.map(a=><button key={a.id} className={'city-asset '+(selected===a.id?'chosen':'')} aria-pressed={selected===a.id} onClick={()=>pick(a.id)}><span className="city-asset-icon" aria-hidden="true">{a.icon}</span><span><strong>{a.name}</strong><small>{a.group}</small></span></button>)}</div>
     <article className="city-detail" aria-live="polite"><div><span>{asset.group}</span><small>{asset.id}</small></div><h2>{asset.name}</h2><p>{asset.description}</p><p className="city-detail-note">{asset.note}</p><button disabled={!ready} onClick={()=>{if(isolated)canvas.current?.reset();else canvas.current?.focus(selected);setSheet(false);}}>가까이 보기 <span>↗</span></button></article>
     <div className="city-data-link"><strong>실제 대전 여행을 계획하려면</strong><p>공개 자료에 안내된 시설 정보와<br/>방문 전 확인할 내용을 살펴보세요.</p><button onClick={onPlaces}>대전 장소 정보로 이동 →</button></div>
    </div>
   </aside>
   <section className="city-stage" aria-label="갈수있슈 3D 도시">
    <SceneCanvas ref={canvas} url={isolated?'/models/assets/'+asset.file+'.glb?v=architecture4':'/models/district-architecture.glb'} isolated={isolated} playing={playing&&!isolated} routeVisible={route} onPick={pick} onReady={setReady} onTime={(t,d)=>{setTime(t);setDuration(d);if(d>0&&t>=d)setPlaying(false);}}/>
    <div className="city-stage-heading"><span className="city-badge">{isolated?'부품 살펴보기':'미니어처 도시'}</span><h2>{isolated?asset.name:'한 걸음씩, 함께 가는 도시'}</h2><p>{isolated?'드래그해서 뒷면까지 살펴보세요.':'드래그하여 회전 · 두 손가락으로 이동·확대'}</p></div>
    <div className="city-controls" aria-label="3D 화면 조작"><button disabled={!ready} aria-label="확대" onClick={()=>canvas.current?.zoom(1.25)}>＋</button><button disabled={!ready} aria-label="축소" onClick={()=>canvas.current?.zoom(.8)}>−</button><button disabled={!ready} aria-label="전체 시점으로 돌아가기" onClick={()=>canvas.current?.reset()}>⌖</button>{!isolated&&<button aria-pressed={route} aria-label="시연 경로 표시" className={route?'chosen':''} onClick={()=>setRoute(!route)}>⌁</button>}</div>
    <div className="city-model-note"><span>제작용 시험 공간</span><p>실제 대전 지형·시설 위치와 다릅니다.</p></div>
    {!isolated&&<div className="city-playback"><div className="city-playback-heading"><span className="city-motion-dot"/><strong>{ready?stage:'도시를 준비하고 있어요'}</strong><span>{Math.floor(time)} / {Math.round(duration||64)}초</span></div><div className="city-playback-controls"><button className="city-play" disabled={!ready} aria-label={playing?'이동 일시정지':'이동 재생'} onClick={()=>{if(time>=duration)canvas.current?.seek(0);setPlaying(!playing);}}>{playing?'Ⅱ':'▶'}</button><input type="range" aria-label="3D 이동 진행 위치" min="0" max={duration||64} step=".1" value={time} disabled={!ready} onChange={e=>{setPlaying(false);canvas.current?.seek(Number(e.target.value));}}/><button className="city-restart" disabled={!ready} aria-label="처음부터 다시 보기" onClick={()=>{canvas.current?.seek(0);setPlaying(false);}}>↺</button></div><small>정해 둔 동선을 재생하는 시연이에요. 실제 길 안내가 아니에요.</small></div>}
   </section>
  </main>
 </div>;
}
