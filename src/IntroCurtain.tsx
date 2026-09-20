import {useEffect,useRef,useState} from 'react';

// The first thing a visitor meets: a film about a family travelling together, including the people
// who usually get left at home.
//
// Replacing the film: put intro.mp4 (and optionally intro-poster.jpg) in public/film/. It is used
// automatically, the drawn placeholder stops rendering, and everything after it is unchanged.
//
// It lives in /film/ rather than /assets/. Everything under /assets/ is served immutable for a year,
// which is right for Vite's hashed bundles and wrong for a file whose name never changes: a browser
// that once asked for it before it existed got the SPA's index.html back and cached that HTML under
// this URL for a year, so the film would never load for that visitor again.
//
// It does not start on its own. A page nobody has touched is not allowed to make noise, so an
// autoplaying film would have to be silent; asking for a press first means the press is the gesture
// the browser wants, and the film can be heard.
const VIDEO='/film/intro.mp4';
const POSTER='/film/intro-poster.jpg';

// Timed to what is on screen:
//   0.0  four of them set out together — grandmother with a cane, a stroller
//   2.4  they reach a flight of steps and stop; the father looks back
//   4.6  the map takes over, a route draws itself, the steps marked with a no-entry sign
//   7.4  they arrive at 한빛탑 together, past a low-floor bus and a lift
// The closing line is not a full stop; it hands over to the name, which answers it.
const CAPTIONS=[
 {at:0.2,until:2.4,line:'오늘은 할머니도 함께 가기로 했어요'},
 {at:2.6,until:4.4,line:'계단 하나에, 넷 모두가 멈춰 섰습니다'},
 {at:4.8,until:7.2,line:'할머니가 갈 수 있는 길을 찾았습니다'},
 {at:7.4,until:10,line:'그래서 오늘, 넷 다 한빛탑까지'},
];

export function IntroCurtain({onExplore,onSimulate}:{onExplore:()=>void;onSimulate:()=>void}){
 const [hasFilm,setHasFilm]=useState(true);
 const [started,setStarted]=useState(false);
 const [muted,setMuted]=useState(false);
 const [done,setDone]=useState(false);
 const [at,setAt]=useState(0);
 const video=useRef<HTMLVideoElement>(null);
 const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;

 function begin(){
  setStarted(true);
  const el=video.current;
  if(!el){setHasFilm(false);return;}
  el.muted=false;
  // If sound is refused anyway, the film still runs — silently, and the control says so rather than
  // claiming otherwise.
  el.play().catch(()=>{el.muted=true;setMuted(true);el.play().catch(()=>setHasFilm(false));});
 }

 // Without a film there is nothing to press, so the drawn placeholder runs on its own timer.
 useEffect(()=>{
  if(hasFilm||!started)return;
  if(reduced){setDone(true);return;}
  const timer=setTimeout(()=>setDone(true),7200);
  return()=>clearTimeout(timer);
 },[hasFilm,started,reduced]);

 useEffect(()=>{
  if(!done)return;
  try{
   const Ctx=window.AudioContext??(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
   if(!Ctx)return;
   const ctx=new Ctx();
   if(ctx.state!=='running'){ctx.close();return;}
   const gain=ctx.createGain();gain.connect(ctx.destination);
   gain.gain.setValueAtTime(0.0001,ctx.currentTime);
   gain.gain.exponentialRampToValueAtTime(0.08,ctx.currentTime+0.04);
   gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.7);
   for(const [note,delay] of [[659.25,0],[880,0.09]] as const){
    const osc=ctx.createOscillator();osc.type='sine';osc.frequency.value=note;
    osc.connect(gain);osc.start(ctx.currentTime+delay);osc.stop(ctx.currentTime+0.75);
   }
   setTimeout(()=>ctx.close(),1200);
  }catch{/* nothing to do if the browser will not allow it */}
 },[done]);

 function toggleSound(){
  const el=video.current;if(!el)return;
  el.muted=!el.muted;setMuted(el.muted);
 }

 return <div className="intro-curtain" role="dialog" aria-modal="true" aria-label="갈수있슈 소개">
  {hasFilm&&<><video ref={video} className="intro-film" src={VIDEO} poster={POSTER} playsInline preload="auto"
   onTimeUpdate={e=>setAt(e.currentTarget.currentTime)}
   onEnded={e=>{e.currentTarget.pause();setDone(true);}} onError={()=>setHasFilm(false)}/>
   {started&&!done&&<p className="intro-caption" aria-live="polite">{CAPTIONS.find(c=>at>=c.at&&at<c.until)?.line??''}</p>}</>}

  {!hasFilm&&started&&<div className={'intro-stage'+(reduced?' is-still':'')} aria-hidden="true">
   <svg viewBox="0 0 900 520" preserveAspectRatio="xMidYMid slice">
    <defs>
     <linearGradient id="intro-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#1d3545"/><stop offset="1" stopColor="#2f5063"/>
     </linearGradient>
    </defs>
    <rect width="900" height="520" fill="url(#intro-sky)"/>
    <g fill="#26445708" stroke="#5b7f93" strokeWidth="1.2" opacity=".55">
     {[40,120,190,275,350,430,505,590,665,745,820].map((x,i)=>(
      <rect key={x} x={x} y={330-((i*37)%90)} width={52} height={190+((i*37)%90)} rx="3"/>
     ))}
    </g>
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

  {/* The gate. Its press is what lets the film be heard. */}
  {!started&&<div className="intro-gate">
   <div className="intro-dim"/>
   <div className="intro-gate-body">
    <p className="intro-gate-eyebrow">10초만요</p>
    <strong className="intro-gate-title">한 사람이 갈 수 있으면,<br/>온 가족이 갑니다</strong>
    <button className="intro-play" onClick={begin} autoFocus>
     <span className="intro-play-mark" aria-hidden="true">▶</span>
     소개 영상 보기
    </button>
    <p className="intro-gate-note">소리와 함께 재생돼요 · 10초</p>
    <button className="intro-gate-skip" onClick={onExplore}>바로 지도 둘러보기</button>
   </div>
  </div>}

  {/* The last frame holds and darkens rather than cutting to black, and the name resolves out of it. */}
  {done&&<><div className="intro-dim"/>
  <div className="intro-finale">
   <strong className="intro-wordmark">갈수있슈</strong>
   <p className="intro-tagline">한 사람이 갈 수 있으면, 온 가족이 갑니다</p>
   <span className="intro-rule"/>
  </div></>}

  {started&&<div className={'intro-actions'+(done?' is-ready':'')}>
   {done
    ?<><button className="intro-primary" onClick={onSimulate}>▶ 3D 시뮬레이션 보기</button>
      <button className="intro-secondary" onClick={onExplore}>지도부터 둘러볼게요</button></>
    :<><button className="intro-sound" aria-pressed={!muted} onClick={toggleSound}>{muted?'소리 켜기':'소리 끄기'}</button>
      <button className="intro-skip" onClick={()=>setDone(true)}>건너뛰기</button></>}
  </div>}
 </div>;
}
