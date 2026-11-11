'use client';
import './master3150-quotes.css';

/** Approved 3150 quote KPI presentation, computed only from real authorized quote stages. */
export default function Master3150QuotesKpis({stages}:{stages:readonly string[]}){
 const normalized=stages.map(stage=>stage.toLowerCase().trim());
 const count=(candidates:string[])=>normalized.filter(stage=>candidates.includes(stage)).length;
 const stats=[
  {name:'Total Quotes',value:normalized.length,tone:'orange'},
  {name:'Open Quotes',value:count(['open','submitted','viewed','shortlisted']),tone:'blue'},
  {name:'Accepted',value:count(['accepted','awarded']),tone:'green'},
  {name:'Rejected',value:count(['rejected','unsuccessful','lost']),tone:'red'},
  {name:'Withdrawn',value:count(['withdrawn']),tone:'gray'},
 ];
 return <section className="xd-quotes-stats" aria-label="Quote status overview" data-master-reference="3150">
  {stats.map(stat=><div className={'xd-quotes-stat '+stat.tone} key={stat.name}>
   <small>{stat.name}</small><strong>{stat.value}</strong>
  </div>)}
 </section>;
}
