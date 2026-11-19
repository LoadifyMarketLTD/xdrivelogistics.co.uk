import {toCanonicalInvoiceStatus,toCanonicalInvoiceDisplayStatus,toCanonicalPaymentStatus,isAwaitingPaymentInvoiceStatus} from '../../../lib/invoiceStatus';
import {invoiceSignedNetAmount,invoiceSignedGrossAmount} from '../../../lib/brokerFinance';
import type {WorkspaceInvoice} from './useCompanyWorkspaceData';

const money=(value:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(value);
const recorded=(v:unknown)=>typeof v==='number'&&Number.isFinite(v);
export const issuedDashboardInvoice=(row:WorkspaceInvoice)=>!['Draft','Cancelled'].includes(toCanonicalInvoiceStatus(row.status))&&toCanonicalPaymentStatus(row.payment_status)!=='refunded';
export const paidDashboardInvoice=(row:WorkspaceInvoice)=>issuedDashboardInvoice(row)&&row.document_type!=='credit_note'&&toCanonicalInvoiceDisplayStatus(row.status,row.due_date,row.payment_status)==='Paid';
export const unsettledDashboardInvoice=(row:WorkspaceInvoice)=>issuedDashboardInvoice(row)&&row.document_type!=='credit_note'&&!paidDashboardInvoice(row)&&isAwaitingPaymentInvoiceStatus(toCanonicalInvoiceDisplayStatus(row.status,row.due_date,row.payment_status));
export const overdueDashboardInvoice=(row:WorkspaceInvoice)=>unsettledDashboardInvoice(row)&&toCanonicalInvoiceDisplayStatus(row.status,row.due_date,row.payment_status)==='Overdue';
const verifiedGross=(row:WorkspaceInvoice)=>row.currency?.toUpperCase()==='GBP'&&recorded(row.amount);
const verifiedNet=(row:WorkspaceInvoice)=>row.currency?.toUpperCase()==='GBP'&&(recorded(row.net_amount)||(recorded(row.amount)&&recorded(row.vat_amount)&&Number(row.amount)>=Number(row.vat_amount)));
export function issuedUnsettledGross(rows:WorkspaceInvoice[]){
 const issued=rows.filter(unsettledDashboardInvoice);
 if(issued.some(row=>!verifiedGross(row)||toCanonicalPaymentStatus(row.payment_status)==='partially_paid'))return 'See register';
 return money(issued.reduce((sum,row)=>sum+invoiceSignedGrossAmount(row),0));
}
export function issuedNetMargin(revenue:WorkspaceInvoice[],cost:WorkspaceInvoice[]){
 const r=revenue.filter(issuedDashboardInvoice),c=cost.filter(issuedDashboardInvoice);
 return [...r,...c].some(row=>!verifiedNet(row))?'See register':money(r.reduce((sum,row)=>sum+invoiceSignedNetAmount(row),0)-c.reduce((sum,row)=>sum+invoiceSignedNetAmount(row),0));
}
