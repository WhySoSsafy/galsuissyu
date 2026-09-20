import {companions,entries,fieldLabels,sectionLabels,type BarrierFree,type Companion,type TourPlace} from './tour-data';

// A report has to land somewhere public to be worth asking for, so it goes to OpenStreetMap's note
// queue at the place's own coordinates. Anyone can read it, including the map data this app runs on.
function noteUrl(place:TourPlace){
 const text=`갈수있슈 접근성 제보 · ${place.name}\n(확인한 내용을 적어 주세요. 예: 주출입구에 턱 3cm 있음 / 경사로 있음 / 엘리베이터 운행 중단)`;
 return `https://www.openstreetmap.org/note/new?lat=${place.lat}&lon=${place.lon}#map=19/${place.lat}/${place.lon}&layers=N&text=${encodeURIComponent(text)}`;
}

const order:(keyof BarrierFree)[]=['getIn','moveAround','vision','hearing','family'];

export function TourAccess({place,companion}:{place:TourPlace;companion:Companion[]}){
 const access=place.barrierFree;
 // Sections the chosen companions care about come first; the rest stay available underneath.
 const wanted=new Set(companions.filter(c=>companion.includes(c.key)).flatMap(c=>c.sections));
 const sections=access?order.filter(key=>entries(access[key]).length).sort((a,b)=>Number(wanted.has(b))-Number(wanted.has(a))):[];
 return <section className="tour-access">
  <div className="tour-access-head">
   <h3>관광공사 무장애 안내</h3>
   {access?<span className="tour-access-badge">공사 등록 {sections.length}개 항목</span>:<span className="tour-access-badge is-empty">등록된 무장애 안내 없음</span>}
  </div>
  {sections.length?<div className="tour-access-groups">{sections.map(key=>
   <div key={key} className={'tour-access-group'+(wanted.has(key)?' is-wanted':'')}>
    <h4>{sectionLabels[key]}{wanted.has(key)&&<em>내 일행에 해당</em>}</h4>
    <dl>{entries(access![key]).map(([field,value])=>
     <div key={field}><dt>{fieldLabels[field]??field}</dt><dd>{value.split('\n').map((line,i)=><span key={i}>{line}</span>)}</dd></div>
    )}</dl>
   </div>
  )}</div>:<p className="dj-detail-copy">이곳은 한국관광공사 무장애 여행정보에 등록되어 있지 않아요. 출입구 턱, 경사로, 승강기 운영은 방문 전에 직접 확인해 주세요.</p>}
  {place.extras&&<dl className="tour-extras">{place.extras.map(x=><div key={x.name}><dt>{x.name}</dt><dd>{x.text}</dd></div>)}</dl>}
  <p className="tour-access-note">공사에 등록된 안내를 원문 그대로 보여드려요. 현장 점검 결과나 당일 운영 상태가 아니에요. 비어 있는 항목은 <strong>없다는 뜻이 아니라 등록되지 않았다는 뜻</strong>이에요.</p>
  <div className="tour-access-actions">
   <a className="tour-report" href={noteUrl(place)} target="_blank" rel="noreferrer">여기 접근성 제보하기 ↗</a>
   <a className="tour-source" href={'https://api.visitkorea.or.kr/#/detail?contentid='+place.contentId} target="_blank" rel="noreferrer">공사 원문 ↗</a>
  </div>
  <small className="tour-report-help">제보는 OpenStreetMap에 공개 기록으로 남아요. 다음 사람과 이 지도가 함께 씁니다.</small>
 </section>;
}
