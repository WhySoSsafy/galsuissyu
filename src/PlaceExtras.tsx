import {useEffect,useRef,useState} from 'react';
import type {AudioGuide} from './tour-extras';
import {forecastFor,type Congestion} from './tour-extras';

// ── 음성 안내 ────────────────────────────────────────────────────────────────
// Most guides carry only a script, not a recording. Reading it aloud in the browser is not a
// substitute made in desperation: it is adjustable in speed, needs no bandwidth, and leaves the
// same words on screen for someone who cannot hear them. Both audiences are served by one record.
export function AudioGuidePanel({guides}:{guides:AudioGuide[]}){
 const [open,setOpen]=useState<string|null>(null);
 const [speaking,setSpeaking]=useState<string|null>(null);
 const player=useRef<HTMLAudioElement|null>(null);
 const canSpeak=typeof window!=='undefined'&&'speechSynthesis' in window;

 // Leaving the place, or the app, must not leave a voice running.
 useEffect(()=>()=>{try{speechSynthesis.cancel();}catch{}player.current?.pause();},[]);
 useEffect(()=>{try{speechSynthesis.cancel();}catch{}player.current?.pause();setSpeaking(null);},[guides]);

 if(!guides.length)return null;

 function stop(){
  try{speechSynthesis.cancel();}catch{}
  player.current?.pause();
  setSpeaking(null);
 }
 function play(guide:AudioGuide){
  if(speaking===guide.id){stop();return;}
  stop();
  if(guide.audio){
   const el=player.current??(player.current=new Audio());
   el.src=guide.audio;
   el.onended=()=>setSpeaking(null);
   el.onerror=()=>{if(canSpeak)speak(guide);else setSpeaking(null);};
   el.play().then(()=>setSpeaking(guide.id)).catch(()=>{if(canSpeak)speak(guide);});
   return;
  }
  if(canSpeak)speak(guide);
 }
 function speak(guide:AudioGuide){
  try{
   const say=new SpeechSynthesisUtterance(guide.script);
   say.lang='ko-KR';say.rate=0.95;
   say.onend=()=>setSpeaking(null);
   say.onerror=()=>setSpeaking(null);
   speechSynthesis.speak(say);
   setSpeaking(guide.id);
  }catch{setSpeaking(null);}
 }

 return <section className="place-audio" aria-label="음성 안내">
  <div className="place-extra-head"><h3>음성 안내</h3><span className="place-extra-badge">관광공사 오디오 가이드 {guides.length}개</span></div>
  <p className="place-extra-lead">해설을 듣거나 읽을 수 있어요. 대전에는 무장애 기록에 청각·시각 안내가 등록된 관광지가 없어, 공사 오디오 가이드로 채웠어요.</p>
  <ul className="audio-list">
   {guides.map(guide=><li key={guide.id}>
    <div className="audio-row">
     <button className={'audio-play'+(speaking===guide.id?' is-playing':'')} onClick={()=>play(guide)}
      aria-label={(speaking===guide.id?'멈추기':'듣기')+' · '+(guide.title||guide.place)}>
      <span aria-hidden="true">{speaking===guide.id?'■':'▶'}</span>
     </button>
     <div className="audio-what">
      <strong>{guide.title||guide.place}</strong>
      <small>{guide.place}{guide.seconds?` · 약 ${Math.round(guide.seconds/60)||1}분`:''}{guide.audio?' · 음성 파일':' · 기기 음성으로 읽어요'}</small>
     </div>
     <button className="audio-read" aria-expanded={open===guide.id} onClick={()=>setOpen(open===guide.id?null:guide.id)}>
      {open===guide.id?'접기':'글로 읽기'}
     </button>
    </div>
    {open===guide.id&&<p className="audio-script">{guide.script}</p>}
   </li>)}
  </ul>
  {!canSpeak&&guides.some(g=>!g.audio)&&<p className="place-extra-note">이 브라우저는 읽어주기를 지원하지 않아요. 해설은 글로 읽을 수 있어요.</p>}
 </section>;
}

// ── 혼잡도 ───────────────────────────────────────────────────────────────────
const DAY=['일','월','화','수','목','금','토'];
const band=(rate:number)=>rate>=60?'busy':rate>=40?'fair':'quiet';
const BAND_LABEL={busy:'붐빔',fair:'보통',quiet:'한산'} as const;

export function CongestionPanel({data,place}:{data:Congestion|null;place:{name:string}|null}){
 const forecast=forecastFor(data,place);
 if(!forecast)return null;
 const peak=Math.max(...forecast.week.map(d=>d.rate),1);
 const fmt=(d:Date)=>`${d.getMonth()+1}/${d.getDate()}`;

 return <section className="place-crowd" aria-label="혼잡도 예측">
  <div className="place-extra-head"><h3>언제 가면 편할까요</h3><span className="place-extra-badge">관광공사 집중률 예측</span></div>
  <p className="place-extra-lead">붐비는 날은 휠체어·유아차가 지나갈 폭이 줄고, 쉴 자리를 찾기 어려워요. 같은 장소라도 날에 따라 달라요.</p>

  <ol className="crowd-week">
   {forecast.week.map(({date,rate})=>{
    const today=new Date();const isToday=date.toDateString()===today.toDateString();
    return <li key={date.toISOString()} className={'is-'+band(rate)+(rate===forecast.quietest.rate?' is-best':'')}>
     <span className="crowd-day">{isToday?'오늘':DAY[date.getDay()]}</span>
     <span className="crowd-bar" aria-hidden="true"><i style={{height:Math.max(8,Math.round(rate/peak*100))+'%'}}/></span>
     <span className="crowd-rate">{Math.round(rate)}</span>
     <span className="crowd-date">{fmt(date)}</span>
    </li>;
   })}
  </ol>

  <p className="crowd-advice">
   {forecast.meaningful
    ?<><strong>{fmt(forecast.quietest.date)}({DAY[forecast.quietest.date.getDay()]})</strong>이 이번 주 가장 한산해요. 가장 붐비는 {fmt(forecast.busiest.date)}({DAY[forecast.busiest.date.getDay()]})보다 집중률이 {Math.round(forecast.busiest.rate-forecast.quietest.rate)} 낮아요.</>
    :<>이번 주는 날마다 크게 다르지 않아요. 언제 가셔도 비슷해요.</>}
  </p>
  <p className="place-extra-note">집중률은 관광공사가 추정한 예측값이에요({BAND_LABEL.quiet} 40 미만 · {BAND_LABEL.fair} 40–60 · {BAND_LABEL.busy} 60 이상). 실제 현장 인원이나 대기 시간을 보장하지 않아요.</p>
 </section>;
}
