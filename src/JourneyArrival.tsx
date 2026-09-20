import {useEffect,useState} from 'react';
import {formatDistance} from './city-data';
import {companions,type Companion} from './tour-data';

/** Completion is a preview milestone, never a claim about the user's GPS location. */
export type ArrivalFacts={minutes:number|null;transfers:number|null;walkDistance:number|null;fare:number|null};

export function JourneyArrival({arrived,destination,facts,companion,onReplay,onExplore,onDetails}:{
 arrived:boolean;destination:string;facts?:ArrivalFacts|null;companion?:Companion[];
 onReplay?:()=>void;onExplore?:()=>void;onDetails?:()=>void;
}){
 const [dismissed,setDismissed]=useState(false);
 useEffect(()=>{if(!arrived)setDismissed(false);},[arrived]);
 if(!arrived||dismissed)return null;

 // The run has just made a specific claim — this group, this destination, this long — so the
 // arrival states it with the numbers behind it rather than announcing that something finished.
 const measures=[
  facts?.minutes!=null&&{value:`${facts.minutes}분`,label:'걸렸어요'},
  facts?.transfers!=null&&{value:`${facts.transfers}번`,label:'갈아타요'},
  facts?.walkDistance!=null&&{value:formatDistance(facts.walkDistance),label:'걸어요'},
  facts?.fare!=null&&{value:`${facts.fare.toLocaleString()}원`,label:'예상 요금'},
 ].filter(Boolean) as {value:string;label:string}[];

 const named=(companion??[]).map(key=>companions.find(c=>c.key===key)?.label).filter(Boolean);

 return <div className="journey-arrival" role="status" aria-live="polite">
  <button className="arrival-close" onClick={()=>setDismissed(true)} aria-label="도착 알림 닫기">×</button>
  <p className="arrival-eyebrow"><span className="arrival-check" aria-hidden="true">✓</span>경로 미리보기 완료</p>
  <strong className="arrival-title">{destination||'목적지'}까지,<br/>{named.length?'다 같이 갈 수 있어요':'갈 수 있어요'}</strong>

  {measures.length>0&&<dl className="arrival-measures">
   {measures.map(m=><div key={m.label}><dt>{m.value}</dt><dd>{m.label}</dd></div>)}
  </dl>}

  {named.length>0&&<p className="arrival-companion">{named.join(' · ')} 조건으로 찾은 동선이에요.</p>}

  <p className="arrival-caveat">실제 이동이 아니라 기록된 도로·노선을 따라 그린 미리보기예요. 저상버스 배차와 승강기 운영, 실시간 도착은 확인하지 않았어요.</p>

  <div className="arrival-actions">
   {onDetails&&<button className="arrival-primary" onClick={onDetails}>구간별로 자세히 보기</button>}
   {onReplay&&<button onClick={onReplay}>다시 보기</button>}
   {onExplore&&<button onClick={onExplore}>다른 곳 찾기</button>}
  </div>
 </div>;
}
