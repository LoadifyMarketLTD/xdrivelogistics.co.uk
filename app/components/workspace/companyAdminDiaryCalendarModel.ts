export type CalendarBooking = {id:string;booking_reference?:string|null;customer_reference?:string|null;pickup_datetime?:string|null;delivery_datetime?:string|null;pickup_location?:string|null;delivery_location?:string|null;status:string};
export const londonDay = (value:Date|string|null|undefined):string => {
  if(!value)return '';
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return '';
  const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const get=(t:string)=>p.find(x=>x.type===t)?.value;
  return [get('year'),get('month'),get('day')].join('-');
};
export const shiftCalendarMonth=(month:string,delta:number):string=>{
  const [year,m]=month.split('-').map(Number);
  return new Date(Date.UTC(year,m-1+delta,1)).toISOString().slice(0,7);
};
export function calendarDays(month:string): string[] {
  const [year,m]=month.split('-').map(Number);
  const first=new Date(Date.UTC(year,m-1,1));
  const offset=(first.getUTCDay()+6)%7;
  return Array.from({length:42},(_,i)=>new Date(Date.UTC(year,m-1,1-offset+i)).toISOString().slice(0,10));
}
export function calendarEvents<T extends CalendarBooking>(jobs:T[]){
  const days=new Map<string,Array<{job:T;kind:'Collection'|'Delivery';at:string}>>();
  const unscheduled:T[]=[];
  for(const job of jobs){
    let scheduled=false;
    for(const [kind,at] of [['Collection',job.pickup_datetime],['Delivery',job.delivery_datetime]] as const){
      const key=londonDay(at);if(!key||!at)continue;
      scheduled=true;const events=days.get(key)??[];events.push({job,kind,at});days.set(key,events);
    }
    if(!scheduled)unscheduled.push(job);
  }
  for(const events of days.values())events.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||a.job.id.localeCompare(b.job.id));
  return {days,unscheduled};
}
