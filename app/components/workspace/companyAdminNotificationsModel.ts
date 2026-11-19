import {londonDay} from './companyAdminDiaryCalendarModel';
export type CompanyNotification={id:string;title:string;body:string|null;type:string|null;read_at:string|null;created_at:string};
export type NotificationCategory='jobs'|'quotes'|'bookings'|'invoices'|'system'|'load_alerts';
export type CompanyNotificationFilter={tab:'all'|'unread'|'operational'|NotificationCategory;query:string;from:string;to:string;status:'all'|'read'|'unread'};
const alerts=new Set(['load_alert','marketplace_load_alert','nearby_load_alert','return_journey_alert','won_load']);
export function notificationCategory(type:string|null):NotificationCategory{
 const t=String(type??'').trim().toLowerCase();
 if(alerts.has(t))return 'load_alerts';
 if(/^(bid_|quote_)/.test(t))return 'quotes';
 if(/^(invoice_|payment_|remittance_)/.test(t))return 'invoices';
 if(/^(booking_|pod_|tracking_|delivery_|collection_|exception_|feedback_)/.test(t))return 'bookings';
 if(/^(job_|load_)/.test(t))return 'jobs';
 return 'system';
}
export const notificationCategoryLabel:Record<NotificationCategory,string>={jobs:'Jobs',quotes:'Quotes',bookings:'Bookings',invoices:'Invoices',system:'System / other',load_alerts:'Load Alerts'};
export function notificationModule(type:string|null):{href:string;label:string}|null{
 const category=notificationCategory(type);
 switch(category){
 case 'jobs':case 'bookings':return {href:'/admin/diary',label:'Open Diary'};
 case 'quotes':return {href:'/admin/exchange-quotes',label:'Open Quotes'};
 case 'invoices':return {href:'/admin/finance',label:'Open Finance'};
 case 'load_alerts':return {href:'/admin/marketplace',label:'Open Loads'};
 default:return null;
 }
}
export function filterCompanyNotifications(rows:CompanyNotification[],f:CompanyNotificationFilter){
 const q=f.query.trim().toLowerCase();
 return rows.filter(r=>{
  const category=notificationCategory(r.type);
  if(f.tab==='unread'&&r.read_at)return false;
  if(f.tab==='operational'&&category==='system')return false;
  if(f.tab!=='all'&&f.tab!=='unread'&&f.tab!=='operational'&&category!==f.tab)return false;
  if(f.status==='read'&&!r.read_at||f.status==='unread'&&r.read_at)return false;
  if(q&&![r.title,r.body,r.type].some(v=>String(v??'').toLowerCase().includes(q)))return false;
  if(f.from||f.to){const day=londonDay(r.created_at);if(!day||f.from&&day<f.from||f.to&&day>f.to)return false;}
  return true;
 }).sort((a,b)=>(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0)||a.id.localeCompare(b.id));
}
