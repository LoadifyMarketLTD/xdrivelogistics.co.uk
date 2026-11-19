export type RouteScheduleStop={label:string;date:string;time:string;end?:string;mode:string};
const validDate=(date:string)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
 const parsed=new Date(date+'T12:00:00Z');
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date;
};
const validSlot=(time:string)=>/^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/.test(time);
const slot=(date:string,time:string)=>Date.parse(date+'T'+time+':00Z');
export function companyAdminRouteScheduleError(stops:RouteScheduleStop[],regularEndDate='',hireEndTime=''){
 let earliest=Number.NEGATIVE_INFINITY;
 for(let index=0;index<stops.length;index++){
  const s=stops[index];
  if(s.mode==='ASAP'&&index>0){
   if(s.date)return s.label+': ASAP does not store a scheduled date. Clear the date or choose a timed option.';
   continue;
  }
  if(!validDate(s.date)||!validSlot(s.time))return s.label+': choose a valid date and 15-minute time slot.';
  const start=slot(s.date,s.time);
  let lower=start,upper=start;
  if(s.mode==='Between'){
   if(!s.end||!validSlot(s.end)||s.end<=s.time)return s.label+': the end of the time window must be later than its start.';
   upper=slot(s.date,s.end);
  }else if(s.mode==='Before'||s.mode==='By'){
   lower=slot(s.date,'00:00');
  }
  earliest=Math.max(earliest,lower);
  if(earliest>upper)return s.label+': the schedule conflicts with the preceding stop. Adjust the date, time or stop order.';
 }
 if(regularEndDate&&(!validDate(regularEndDate)||regularEndDate<stops[0]?.date))return 'Regular Load: the end date must be on or after the collection date.';
 if(hireEndTime&&(!validSlot(hireEndTime)||hireEndTime<=stops[0]?.time))return 'Daily Hire: the end time must be later than the collection start.';
 return '';
}
