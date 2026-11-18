'use client';

import './broker-3150-diary.css';

export type BrokerDiaryTabItem<T extends string = string> = {
  id: T;
  label: string;
  count: number;
};

/** The original approved Broker Diary top section, reused by authenticated workspaces.
 * Only dates, bucket counts and role-dependent callbacks are supplied by the page. */
const localDay=(value:Date)=>[value.getFullYear(),String(value.getMonth()+1).padStart(2,'0'),String(value.getDate()).padStart(2,'0')].join('-');

export function Broker3150DiaryHeader({date,onDateChange}:{date:string;onDateChange:(date:string)=>void}) {
 const changeDay=(delta:number)=>{
  const source=date || localDay(new Date());
  const next=new Date(source+'T12:00:00');
  if(Number.isNaN(next.getTime()))return;
  next.setDate(next.getDate()+delta);
  onDateChange(localDay(next));
 };
 return <header className="xd3150-diary-header">
  <div><h1>Diary</h1><p>Bookings &amp; Operations Schedule</p></div>
  <nav className="xd3150-diary-date-nav" aria-label="Diary date navigation">
   <button type="button" aria-label="Previous day" onClick={()=>changeDay(-1)}>&lsaquo;</button>
   <input type="date" aria-label="Selected diary date" value={date} onChange={e=>onDateChange(e.target.value)}/>
   <button type="button" aria-label="Next day" onClick={()=>changeDay(1)}>&rsaquo;</button>
   <button type="button" className="xd3150-diary-today" onClick={()=>onDateChange(localDay(new Date()))}>Today</button>
   {date&&<button type="button" onClick={()=>onDateChange('')}>All dates</button>}
  </nav>
 </header>;
}

export function Broker3150DiaryTabs<T extends string>({tabs,selected,onSelect,label='Diary states'}:{
 tabs:ReadonlyArray<BrokerDiaryTabItem<T>>;
 selected:T;
 onSelect:(tab:T)=>void;
 label?:string;
}){
 return <div className="xd3150-diary-status-tabs" role="tablist" aria-label={label}>
  {tabs.map(item=><button key={item.id} type="button" role="tab" aria-selected={selected===item.id}
   className={selected===item.id?'active':''} onClick={()=>onSelect(item.id)}>
   {item.label}<span>{item.count}</span>
  </button>)}
 </div>;
}