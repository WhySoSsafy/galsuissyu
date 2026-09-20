import {useEffect,useState} from 'react';

/** Completion is a preview milestone, never a claim about the user's GPS location. */
export function JourneyArrival({arrived,destination,onReplay,onExplore,onDetails}:{
 arrived:boolean;destination:string;
 onReplay?:()=>void;onExplore?:()=>void;onDetails?:()=>void;
}){
 const [dismissed,setDismissed]=useState(false);
 useEffect(()=>{if(!arrived)setDismissed(false);},[arrived]);
 if(!arrived||dismissed)return null;
 // Arriving used to leave nothing to do but close a notice. Someone who has just watched the run is
 // exactly the person most likely to try the app, so the next steps are here rather than hidden.
 const next=onDetails||onExplore||onReplay;
 return <div className="journey-arrival" role="status" aria-live="polite">
  <div className="arrival-head">
   <span className="arrival-check" aria-hidden="true">✓</span>
   <div><strong>도착했어요!</strong><span>{destination||'목적지'} · 경로 미리보기 완료</span></div>
   <button className="arrival-close" onClick={()=>setDismissed(true)} aria-label="도착 알림 닫기">×</button>
  </div>
  {next&&<div className="arrival-actions">
   {onDetails&&<button className="arrival-primary" onClick={onDetails}>이 경로 자세히 보기</button>}
   {onExplore&&<button onClick={onExplore}>다른 곳 찾아보기</button>}
   {onReplay&&<button onClick={onReplay}>다시 보기</button>}
  </div>}
 </div>;
}
