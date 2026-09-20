import {useEffect,useRef,useState} from 'react';

// The first thing a visitor meets. A film belongs here — a family travelling together, with the
// people who usually get left behind — and one can be dropped in at /assets/intro.mp4 without
// touching this file. Until then the placeholder below carries the same sentence.
//
// Replacing it: put intro.mp4 (and optionally intro-poster.jpg) in public/assets/. The video is
// used automatically, the placeholder stops rendering, and the call to action still appears when
// it ends. Anything under about 20 seconds; it can always be skipped.
const VIDEO='/assets/intro.mp4';
const POSTER='/assets/intro-poster.jpg';

export function IntroCurtain({onExplore,onSimulate}:{onExplore:()=>void;onSimulate:()=>void}){
 const [hasFilm,setHasFilm]=useState(true);
 const [done,setDone]=useState(false);
 const video=useRef<HTMLVideoElement>(null);
 const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;

 useEffect(()=>{
  // Nothing at that path yet, or a browser that refuses to play it: fall through to the placeholder.
  const el=video.current;
  if(!el){setHasFilm(false);return;}
  el.play().catch(()=>setHasFilm(false));
 },[]);
 // The placeholder runs on a timer rather than a video's own end event.
 useEffect(()=>{
  if(hasFilm)return;
  if(reduced){setDone(true);return;}
  const timer=setTimeout(()=>setDone(true),7200);
  return()=>clearTimeout(timer);
 },[hasFilm,reduced]);

 return <div className="intro-curtain" role="dialog" aria-modal="true" aria-label="갈수있슈 소개">
  {hasFilm&&<video ref={video} className="intro-film" src={VIDEO} poster={POSTER} muted playsInline autoPlay
   onEnded={()=>setDone(true)} onError={()=>setHasFilm(false)}/>}
  {!hasFilm&&<div className={'intro-stage'+(reduced?' is-still':'')} aria-hidden="true">
   <svg viewBox="0 0 900 520" preserveAspectRatio="xMidYMid slice">
    <defs>
     <linearGradient id="intro-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#1d3545"/><stop offset="1" stopColor="#2f5063"/>
     </linearGradient>
    </defs>
    <rect width="900" height="520" fill="url(#intro-sky)"/>
    {/* A skyline standing in for the city the route crosses. */}
    <g fill="#26445708" stroke="#5b7f93" strokeWidth="1.2" opacity=".55">
     {[40,120,190,275,350,430,505,590,665,745,820].map((x,i)=>(
      <rect key={x} x={x} y={330-((i*37)%90)} width={52} height={190+((i*37)%90)} rx="3"/>
     ))}
    </g>
    {/* The journey itself, drawing on. */}
    <path className="intro-route" d="M70 430 C 210 430 250 300 380 300 S 560 190 700 190 L 840 150"
     fill="none" stroke="#ce6b51" strokeWidth="7" strokeLinecap="round"/>
    <circle className="intro-dot intro-dot-start" cx="70" cy="430" r="13" fill="#fff"/>
    <circle className="intro-dot intro-dot-end" cx="840" cy="150" r="13" fill="#ce6b51" stroke="#fff" strokeWidth="4"/>
   </svg>
   <div className="intro-words">
    <p className="intro-line-a">한 사람이 못 가면</p>
    <p className="intro-line-b">네 사람이 안 갑니다</p>
   </div>
  </div>}

  <div className={'intro-actions'+(done?' is-ready':'')}>
   {done
    ?<><p className="intro-pitch">대전역에서 한빛탑까지, 보행과 지하철과 환승과 버스를 이어서 3D로 먼저 가봅니다.</p>
      <button className="intro-primary" onClick={onSimulate}>▶ 3D 시뮬레이션 보기</button>
      <button className="intro-secondary" onClick={onExplore}>지도부터 둘러볼게요</button></>
    :<button className="intro-skip" onClick={()=>setDone(true)}>건너뛰기</button>}
  </div>
 </div>;
}
