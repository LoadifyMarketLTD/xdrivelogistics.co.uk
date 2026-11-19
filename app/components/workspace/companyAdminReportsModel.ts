import type {WorkspaceDataState,WorkspaceDatasetKey,WorkspaceJob} from './useCompanyWorkspaceData';
import type {SpreadsheetSheet,SpreadsheetValue} from '../../../lib/spreadsheetExport';
import {classifyWorkspaceJobStage,isCompanyExecutionJob,normalizedJobStatus} from '../../../lib/jobs/workspaceJobStage';
import {classifyAccountsDirection} from '../../../lib/finance/accounts';
import {canonicalPodEvidence,canonicalPodStateLabel} from '../../../lib/pod/canonicalPodEvidence';
import {toCanonicalInvoiceDisplayStatus,toCanonicalInvoiceStatus,toCanonicalPaymentStatus} from '../../../lib/invoiceStatus';
import {londonDay} from './companyAdminDiaryCalendarModel';
export const reportSections=['Overview','Loads','Quotes','Bookings','Invoices','Drivers','Vehicles'] as const;
export type ReportSection=typeof reportSections[number];
export type ReportPeriod={from:string;to:string};
export function reportPeriod(days:string,now=new Date()):ReportPeriod{
 const to=londonDay(now);return days==='all'?{from:'',to:''}:{from:new Date(Date.parse(to+'T12:00:00Z')-(Number(days)-1)*86400000).toISOString().slice(0,10),to};
}
export function reportDateMatches(date:string|null|undefined,p:ReportPeriod){
 if(!p.from&&!p.to)return true;const day=londonDay(date);return Boolean(day&&(!p.from||day>=p.from)&&(!p.to||day<=p.to));
}
const ref=(j:WorkspaceJob)=>j.booking_reference||j.load_reference||j.load_ref||j.customer_reference||j.id;
const route=(j:WorkspaceJob)=>[j.pickup_postcode||j.pickup_location||'Not supplied',j.delivery_postcode||j.delivery_location||'Not supplied'].join(' → ');
const number=(v:unknown):number|null=>v==null||String(v).trim()===''||!Number.isFinite(Number(v))?null:Number(v);
const text=(v:unknown)=>String(v??'Not supplied');
const currency=(v:unknown)=>typeof v==='string'&&/^[A-Z]{3}$/.test(v.trim().toUpperCase())?v.trim().toUpperCase():null;
const stage=(j:WorkspaceJob)=>classifyWorkspaceJobStage(j);
const booked=new Set(['awarded','allocated','in_progress','completed']);
const columns=(...pairs:[string,string,number?][])=>pairs.map(([header,key,width])=>({header,key,width:width??22}));
type ReportTable={name:Exclude<ReportSection,'Overview'>;basis:string;verified:boolean;columns:SpreadsheetSheet['columns'];rows:SpreadsheetSheet['rows']};
export function deriveCompanyReports(data:WorkspaceDataState,p:ReportPeriod){
 const company=data.companyId;
 const verified=(...keys:WorkspaceDatasetKey[])=>Boolean(company&&!data.loading&&keys.every(key=>{const d=data.datasets[key];return d?.availability==='available'&&!d.partialData&&!d.limitedData&&!d.queryErrors.length}));
 const ownAll=company?data.jobs.filter(j=>j.company_id===company):[];
 const jobs=ownAll.filter(j=>reportDateMatches(j.created_at,p)&&normalizedJobStatus(j)!=='draft');
 const bookings=company?data.jobs.filter(j=>isCompanyExecutionJob(j,company)&&booked.has(stage(j))&&reportDateMatches(j.pickup_datetime,p)):[];
 const ownIds=new Set(ownAll.map(j=>j.id));
 const bids=company?data.bids.filter(b=>(b.company_id===company||ownIds.has(b.job_id))&&reportDateMatches(b.created_at,p)):[];
 const invoices=company?data.invoices.filter(i=>classifyAccountsDirection(i,company)&&reportDateMatches(i.invoice_date,p)):[];
 const drivers=company?data.drivers:[],vehicles=company?data.vehicles:[];
 const jobsById=new Map(data.jobs.map(j=>[j.id,j]));
 const driverById=new Map(drivers.map(d=>[d.id,d.display_name||d.id]));
 const baseJob=(j:WorkspaceJob)=>({reference:ref(j),customerReference:j.customer_reference??null,route:route(j),status:stage(j),vehicle:j.vehicle_type??null,driver:driverById.get(j.assigned_driver_id??'')??null,created:j.created_at,pickup:j.pickup_datetime,delivery:j.delivery_datetime,customer:j.client_name??null,vehicleId:j.vehicle_id??null,jobId:j.id,driverId:j.assigned_driver_id??null,budgetGBP:number(j.budget_amount),pod:canonicalPodStateLabel(canonicalPodEvidence(j).state)});
 const jobColumns=columns(['Reference','reference'],['Customer ref','customerReference'],['Route','route',38],['Stage','status'],['Vehicle type','vehicle'],['Driver','driver'],['Created','created'],['Pickup','pickup'],['Delivery','delivery'],['Customer','customer'],['Vehicle ID','vehicleId'],['Job ID','jobId'],['Driver ID','driverId'],['Recorded budget GBP','budgetGBP'],['POD evidence','pod']);
 const invoiceRows=invoices.map(i=>({reference:i.invoice_number||i.id,job:i.job_id?jobsById.has(i.job_id)?ref(jobsById.get(i.job_id)!):i.job_id:null,direction:classifyAccountsDirection(i,company),status:toCanonicalInvoiceDisplayStatus(i.status,i.due_date,i.payment_status),payment:toCanonicalPaymentStatus(i.payment_status),document:i.document_type??null,net:number(i.net_amount),vat:number(i.vat_amount),gross:number(i.amount),currency:currency(i.currency),issued:i.invoice_date??null,due:i.due_date??null,counterparty:i.client_name??null,rawStatus:toCanonicalInvoiceStatus(i.status)}));
 const tables:ReportTable[]=[
 {name:'Loads',basis:'Own non-draft loads by creation date; current lifecycle state.',verified:verified('jobs'),columns:jobColumns,rows:jobs.map(baseJob)},
 {name:'Quotes',basis:'Company sent and received quotes by quote creation date.',verified:verified('jobs','bids'),columns:columns(['Quote ID','reference'],['Job','job'],['Direction','direction'],['Status','status'],['Price GBP','gbp'],['Recorded amount','amount'],['Currency','currency'],['Created','created']),rows:bids.map(b=>({reference:b.id,job:jobsById.has(b.job_id)?ref(jobsById.get(b.job_id)!):b.job_id,direction:b.company_id===company?'Sent':'Received',status:b.status,gbp:number(b.bid_price_gbp),amount:number(b.amount),currency:currency(b.currency),created:b.created_at}))},
 {name:'Bookings',basis:'Company execution bookings by collection date; current lifecycle state.',verified:verified('jobs'),columns:jobColumns,rows:bookings.map(baseJob)},
 {name:'Invoices',basis:'Company invoice register by invoice date. Gross is not outstanding balance.',verified:verified('invoices'),columns:columns(['Invoice','reference'],['Job','job'],['Direction','direction'],['Status','status'],['Payment status','payment'],['Document type','document'],['Net','net'],['VAT','vat'],['Gross','gross'],['Currency','currency'],['Invoice date','issued'],['Due date','due'],['Counterparty','counterparty']),rows:invoiceRows},
 {name:'Drivers',basis:'Current fleet snapshot, with bookings in the selected collection period.',verified:verified('drivers','jobs'),columns:columns(['Driver','driver'],['Status','status'],['Availability','availability'],['Bookings','bookings'],['Completed','completed']),rows:drivers.map(d=>({driver:d.display_name||d.id,status:d.status,availability:d.availability_status,bookings:bookings.filter(j=>j.assigned_driver_id===d.id).length,completed:bookings.filter(j=>j.assigned_driver_id===d.id&&stage(j)==='completed').length}))},
 {name:'Vehicles',basis:'Current vehicle snapshot, with bookings linked by canonical vehicle ID.',verified:verified('vehicles','jobs'),columns:columns(['Registration / ID','registration'],['Vehicle type','type'],['Body type','body'],['Assigned driver','driver'],['Bookings','bookings'],['Completed','completed']),rows:vehicles.map(v=>({registration:v.reg_plate||v.id,type:v.type,body:v.body_type,driver:driverById.get(v.assigned_driver_id??'')??null,bookings:bookings.filter(j=>j.vehicle_id===v.id).length,completed:bookings.filter(j=>j.vehicle_id===v.id&&stage(j)==='completed').length}))}
 ];
 const aggregate=(values:string[])=>[...new Set(values)].map(label=>({label,count:values.filter(v=>v===label).length})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label));
 const issued=invoiceRows.filter(i=>!['Draft','Cancelled'].includes(i.rawStatus)&&i.payment!=='refunded'&&i.document!=='credit_note');
 const financial=new Map<string,{direction:string;currency:string;gross:number;count:number}>();
 for(const i of issued){if(i.gross===null||!i.currency||!i.direction)continue;const key=i.direction+' '+i.currency;const total=financial.get(key)??{direction:i.direction,currency:i.currency,gross:0,count:0};total.gross+=i.gross;total.count++;financial.set(key,total);}
 return {tables,completed:verified('jobs')?bookings.filter(j=>stage(j)==='completed').length:null,statuses:verified('jobs')?aggregate(jobs.map(j=>stage(j))):[],routes:verified('jobs')?aggregate(jobs.map(route)).slice(0,5):[],vehicleTypes:verified('jobs')?aggregate(jobs.map(j=>j.vehicle_type||'Not supplied')):[],financial:verified('invoices')?[...financial.values()]:[],missingFinancial:verified('invoices')?issued.filter(i=>i.gross===null||!i.currency).length:null,issuedCount:verified('invoices')?issued.length:null};
}
export function makeReportSheets(report:ReturnType<typeof deriveCompanyReports>,section:ReportSection|'Full',period:ReportPeriod):SpreadsheetSheet[]{
 const subtitle=(period.from||'All dates')+' to '+(period.to||'All dates')+' · UK calendar; current record states';
 const selected=section==='Full'||section==='Overview'?report.tables:report.tables.filter(t=>t.name===section);
 const summary:SpreadsheetSheet={name:'Summary',title:'Company operational report',subtitle,columns:columns(['Dataset','dataset'],['Records','records'],['Coverage / date basis','basis',65]),rows:selected.map(t=>({dataset:t.name,records:t.verified?t.rows.length:'Unavailable / partial',basis:t.basis}))};
 const sheets:SpreadsheetSheet[]=selected.filter(t=>t.verified).map(t=>({name:t.name,title:t.name+' report',subtitle:subtitle+' · '+t.basis,columns:t.columns,rows:t.rows}));
 if(section==='Full'||section==='Overview'){const invoiceTable=selected.find(t=>t.name==='Invoices'&&t.verified);if(invoiceTable){const unsettled=invoiceTable.rows.filter(i=>['Sent','Overdue','Disputed'].includes(String(i.status))&&i.payment!=='refunded'&&i.rawStatus!=='Draft'&&i.rawStatus!=='Cancelled'&&i.document!=='credit_note');sheets.push({name:'Unsettled invoices',title:'Unsettled invoice follow-up',subtitle:subtitle+' · Gross invoice values only; actual outstanding balances require payment reconciliation.',columns:invoiceTable.columns,rows:unsettled});}return [summary,...sheets];}return sheets;
}
export const reportCell=(value:SpreadsheetValue)=>value==null||value===''?'Not supplied':text(value);
