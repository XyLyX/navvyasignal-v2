'use client';
import {useEffect,useState} from 'react';
import type {Story} from '@/lib/notion';
import {editorialState,type EditorialKind,type EditorialAssessment} from '@/lib/editorialFormatStatus';
import ExpandableEditorial from './ExpandableEditorial';
const labels:Record<EditorialKind,string>={'Cross-Desk':'CROSS-DESK INTELLIGENCE','Briefing':'WEEKLY BRIEFING','Long Read':'LONG READS'};
export default function EditorialPanel({kind,heading,story,assessments,initialNow}:{
 kind:EditorialKind;heading:string;story:Story|undefined;assessments:EditorialAssessment[];initialNow:number;
}) {
 const [now,setNow]=useState(initialNow);
 useEffect(()=>{const update=()=>setNow(Date.now());update();const timer=setInterval(update,60000);
 document.addEventListener('visibilitychange',update);
 return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update)}},[]);
 const state=editorialState(kind,story,assessments,new Date(now));
 const date=(value:string)=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Dubai',day:'numeric',month:'short',year:'numeric'}).format(new Date(value));
 return <section className="editorial-panel">
  <span className="kicker">{labels[kind]}</span><h2>{heading}</h2>
  <div className="editorial-status">
   {!state.current&&<p className="editorial-pending">{state.message}{story?' Previous report retained below.':''}</p>}
   {story&&<p className="edition-line">{state.current?'Current edition':'Previous report'} · Published <time dateTime={story.createdAt}>{date(story.createdAt)}</time></p>}
  </div>
  {story?<ExpandableEditorial story={kind==='Briefing'?{...story,brief:story.brief||story.body.slice(0,1200)}:story}/>:
   <p className="editorial-pending">No approved report is available yet.</p>}
 </section>;
}
