import {useEffect,useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type {Mobility} from './city-data';
import {companions,type Companion} from './tour-data';

// Each step is a picture question. Someone meeting this for the first time should be able to tell
// what is being asked without reading a word, so the title carries its own image and every option
// is a card with one.
const art=(name:string)=>'/assets/survey/'+name+'.webp';
const STEPS=[
 {key:'companion',image:'step-companion',title:'누구와 함께 가시나요?',help:'일행 중 한 사람이 못 가면 모두가 못 가요. 함께 가는 분에 맞춰 안내를 골라 드려요.'},
 {key:'route',image:'step-route',title:'어떤 길이 더 편하신가요?',help:'해당하는 항목을 모두 골라 주세요. 나중에 바꿀 수 있어요.'},
 {key:'surface',image:'step-surface',title:'조금 더 편한 길을 골라요',help:'노면과 경사에 대한 선호를 반영해요.'},
] as const;

const routeChoices=[
 {key:'wheelchair',image:'wheelchair',title:'휠체어·유아차로 이동해요',copy:'휠체어 불가로 등록된 길을 제외해요.'},
 {key:'steps',image:'ramp',title:'계단 없는 길이 좋아요',copy:'계단으로 등록된 구간을 제외해요.'},
 {key:'rest',image:'rest',title:'중간중간 쉬고 싶어요',copy:'경로와 도착지 주변 쉼터를 함께 봐요.'},
] as const;
// The last step used to be two bare checkboxes — the only screen in the flow without a picture.
const surfaceChoices=[
 {key:'steep',image:'slope',title:'가파른 경사를 피할게요',copy:'경사 5% 초과로 기록된 구간을 제외해요.'},
 {key:'rough',image:'surface',title:'매끄러운 길이 좋아요',copy:'자갈·흙·모래로 기록된 길을 제외해요.'},
] as const;

function Card({pressed,image,title,copy,onClick}:{pressed:boolean;image:string;title:string;copy:string;onClick:()=>void}){
 return <button type="button" aria-pressed={pressed} onClick={onClick}>
  <span className="survey-check" aria-hidden="true">{pressed?'✓':'+'}</span>
  <span className="survey-card-art"><img src={art(image)} alt="" loading="lazy" onError={e=>{(e.currentTarget as HTMLImageElement).hidden=true;}}/></span>
  <strong>{title}</strong><small>{copy}</small>
 </button>;
}

export function MobilitySurvey({open,onOpenChange,value,onSave,companion}:{
 open:boolean;onOpenChange:(v:boolean)=>void;value:Mobility;onSave:(p:Mobility,companion:Companion[])=>void;companion:Companion[];
}){
 const [draft,setDraft]=useState(value),[step,setStep]=useState(0),[group,setGroup]=useState<Companion[]>(companion);
 useEffect(()=>{if(open){setDraft(value);setGroup(companion);setStep(0);}},[open]);
 const current=STEPS[step],last=step===STEPS.length-1;
 const toggle=(key:'wheelchair'|'steps'|'rest'|'steep'|'rough')=>setDraft(p=>({...p,[key]:!p[key]}));

 return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal>
  <Dialog.Overlay className="dj-survey-overlay"/>
  <Dialog.Content className="mobility-survey">
   <Dialog.Close className="dj-survey-close" aria-label="설문 닫기">×</Dialog.Close>
   <div className="survey-content">
    <header className="survey-head">
     <span className="survey-head-art" aria-hidden="true"><img src={art(current.image)} alt="" onError={e=>{(e.currentTarget as HTMLImageElement).hidden=true;}}/></span>
     <div>
      <span className="survey-step">나에게 맞는 여행 준비 · {step+1} / {STEPS.length}</span>
      <Dialog.Title>{current.title}</Dialog.Title>
      <Dialog.Description>{current.help}</Dialog.Description>
     </div>
    </header>

    <div className="survey-body">
     {step===0&&<div className="survey-cards survey-cards-5">{companions.map(c=>
      <Card key={c.key} pressed={group.includes(c.key)} image={c.image} title={c.label} copy={c.help}
       onClick={()=>setGroup(g=>g.includes(c.key)?g.filter(k=>k!==c.key):[...g,c.key])}/>)}</div>}

     {step===1&&<div className="survey-cards survey-cards-3">{routeChoices.map(c=>
      <Card key={c.key} pressed={draft[c.key]} image={c.image} title={c.title} copy={c.copy} onClick={()=>toggle(c.key)}/>)}</div>}

     {step===2&&<><div className="survey-cards survey-cards-2">{surfaceChoices.map(c=>
      <Card key={c.key} pressed={draft[c.key]} image={c.image} title={c.title} copy={c.copy} onClick={()=>toggle(c.key)}/>)}</div>
      <div className="survey-note"><strong>모르는 정보는 모른다고 알려드려요.</strong>
       <p>선택한 조건은 등록된 도로 정보에 반영돼요. 시설 고장이나 미등록 턱까지 확인된 경로라는 뜻은 아니에요.</p></div></>}
    </div>

    <div className="survey-footer">
     {step>0&&<button onClick={()=>setStep(step-1)}>이전</button>}
     <button className="survey-next" onClick={()=>last?onSave(draft,group):setStep(step+1)}>{last?'대전 둘러보기':'다음'} →</button>
    </div>
   </div>
   <aside className="survey-art">
    <img src={art('family')} alt="" onError={e=>{(e.currentTarget as HTMLImageElement).hidden=true;}}/>
    <strong>한 사람이<br/>갈 수 있으면,<br/>온 가족이 갑니다.</strong>
   </aside>
  </Dialog.Content>
 </Dialog.Portal></Dialog.Root>;
}
