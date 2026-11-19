import {londonDay} from './companyAdminDiaryCalendarModel';

export type ReturnSchedule = {id:string;status:string|null;available_from:string|null;available_to:string|null;from_postcode:string|null;to_postcode:string|null};
export type ReturnDateFilter='all'|'today'|'next7';
export type ReturnSort='soonest'|'latest'|'route';
const norm=(v:string|null)=>String(v??'').trim().toLowerCase();
const time=(v:string|null)=>v?Date.parse(v):NaN;
export function returnAvailability(row:ReturnSchedule,now=new Date()){
  const status=norm(row.status);
  if(!['active','available'].includes(status))return status||'unknown';
  const end=time(row.available_to);
  if(Number.isFinite(end)&&end<now.getTime())return 'expired';
  return 'active';
}
export function returnDateMatches(row:ReturnSchedule,filter:ReturnDateFilter,now=new Date()){
  if(filter==='all')return true;
  if(returnAvailability(row,now)!=='active')return false;
  const from=londonDay(row.available_from),to=londonDay(row.available_to),today=londonDay(now);
  const last=filter==='today'?today:new Date(Date.parse(today+'T12:00:00Z')+6*86400000).toISOString().slice(0,10);
  // An unknown start must not be reported as verified availability.
  return Boolean(from&&from<=last&&(!row.available_to||Boolean(to&&to>=today)));
}
export function sortCompanyReturns<T extends ReturnSchedule>(rows:T[],sort:ReturnSort){
  return [...rows].sort((a,b)=>{
    if(sort==='route')return norm(a.from_postcode).localeCompare(norm(b.from_postcode))||norm(a.to_postcode).localeCompare(norm(b.to_postcode))||a.id.localeCompare(b.id);
    const x=time(a.available_from),y=time(b.available_from);
    if(!Number.isFinite(x))return Number.isFinite(y)?1:a.id.localeCompare(b.id);
    if(!Number.isFinite(y))return -1;
    return (sort==='latest'?y-x:x-y)||a.id.localeCompare(b.id);
  });
}
export function validateReturnEditor(input:{driverId:string;activeDriverIds:string[];from:string;to:string;anywhere:boolean;start:string;end:string;weight:string;space:string;via:string;notes:string;vehicle:string;body:string}){
  if(!input.activeDriverIds.includes(input.driverId))return 'Select an active driver in this company.';
  if(!input.from.trim())return 'Returning from is required.';
  if(!input.anywhere&&!input.to.trim())return 'Enter a destination or select Go Anywhere.';
  if(input.from.trim().length>120||input.to.trim().length>120)return 'Route locations must not exceed 120 characters.';
  if(!input.start||!Number.isFinite(Date.parse(input.start)))return 'Enter a valid availability start.';
  if(input.end&&(!Number.isFinite(Date.parse(input.end))||Date.parse(input.end)<Date.parse(input.start)))return 'Available to must not be before Available from.';
  for(const [label,v] of [['Weight',input.weight],['Space / pallets',input.space]])if(v.trim()&&(!Number.isFinite(Number(v))||Number(v)<0))return label+' must be a non-negative number.';
  const via=input.via.split(',').map(x=>x.trim()).filter(Boolean);
  if(via.length>8||via.some(x=>x.length>160))return 'Use up to 8 via locations, each at most 160 characters.';
  if(input.notes.length>3000||input.vehicle.length>100||input.body.length>100)return 'Notes or vehicle details exceed the permitted length.';
  return '';
}
