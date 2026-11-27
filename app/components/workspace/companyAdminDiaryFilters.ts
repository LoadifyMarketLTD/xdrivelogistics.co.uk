import {londonDay} from './companyAdminDiaryCalendarModel';

export function diaryDateMatches(value:string|null|undefined,from:string,to:string){
  if(!from&&!to)return true;
  const key=londonDay(value);
  return Boolean(key&&(!from||key>=from)&&(!to||key<=to));
}

export function diaryTimeMatches(value:string|null|undefined,window:string){
  if(window==='any')return true;
  if(!value)return false;
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return false;
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',hourCycle:'h23'}).format(date));
  return window==='morning'?hour<12:window==='afternoon'?hour>=12&&hour<17:window==='evening'?hour>=17:false;
}
export function diaryTomorrow(now=new Date()){
  const today=londonDay(now);
  return new Date(Date.parse(today+'T12:00:00Z')+86_400_000).toISOString().slice(0,10);
}
export function companyDiaryDefaultKey(companyId:string|null,userId:string|null|undefined){
  return companyId&&userId?'xdrive:company-admin:diary:default-search:'+encodeURIComponent(companyId)+':'+encodeURIComponent(userId):null;
}
export function knownPositiveNumber(value:unknown){
  if(value==null||String(value).trim()==='')return null;
  const n=Number(value);
  return Number.isFinite(n)&&n>0?n:null;
}
export function validDiaryDate(value:string){
  return /^\d{4}-\d{2}-\d{2}$/.test(value)&&londonDay(value+'T12:00:00Z')===value;
}

export function diaryBookingDateMatches(job:{pickup_datetime?:string|null;delivery_datetime?:string|null},from:string,to:string){
  return diaryDateMatches(job.pickup_datetime,from,to)||diaryDateMatches(job.delivery_datetime,from,to);
}
