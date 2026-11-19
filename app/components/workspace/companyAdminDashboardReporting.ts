import {classifyAccountsDirection} from '../../../lib/finance/accounts';
import {toCanonicalInvoiceDisplayStatus,isAwaitingPaymentInvoiceStatus,toCanonicalPaymentStatus} from '../../../lib/invoiceStatus';
import {londonDay} from './companyAdminDiaryCalendarModel';
import type {WorkspaceInvoice} from './useCompanyWorkspaceData';

export function companyReportDates(preset:string,now=new Date()){
  const today=londonDay(now);
  if(preset==='month')return {from:today.slice(0,8)+'01',to:today};
  if(preset==='today')return {from:today,to:today};
  if(preset==='all')return {from:'',to:''};
  if(preset==='7'||preset==='30'||preset==='90'){
    const before=new Date(Date.parse(today+'T12:00:00Z')-(Number(preset)-1)*86400000);
    return {from:before.toISOString().slice(0,10),to:today};
  }
  return null;
}
export function companyReportDateMatches(value:string|null|undefined,from:string,to:string,allTime=false){
  if(allTime)return true;
  const day=londonDay(value);
  return Boolean(day&&from&&to&&from<=to&&day>=from&&day<=to);
}
export function summarizeCompanyPayables(rows:WorkspaceInvoice[],companyId:string|null,from:string,to:string,allTime=false){
  const all=rows.filter(row=>classifyAccountsDirection(row,companyId)==='payable');
  const issued=all.filter(row=>{
    const state=toCanonicalInvoiceDisplayStatus(row.status,row.due_date,row.payment_status);
    return !['Draft','Cancelled'].includes(state)&&toCanonicalPaymentStatus(row.payment_status)!=='refunded';
  });
  const inRange=issued.filter(row=>companyReportDateMatches(row.invoice_date??row.created_at,from,to,allTime));
  const states=issued.map(row=>toCanonicalInvoiceDisplayStatus(row.status,row.due_date,row.payment_status));
  return {all,issued,inRange,paid:states.filter(s=>s==='Paid').length,overdue:states.filter(s=>s==='Overdue').length,awaiting:states.filter(s=>s!=='Overdue'&&isAwaitingPaymentInvoiceStatus(s)).length};
}