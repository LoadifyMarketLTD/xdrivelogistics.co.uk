export type ReportInvoice={id:string;invoice_number:string;client_name:string;status:string;payment_status:string;amount:number;currency:string;due_date:string|null};
export type ReportPayment={invoice_id:string;amount:number;currency:string;paid_at?:string|null};
export function reconcileOwnerPayments(invoices:ReportInvoice[],payments:ReportPayment[]){
 const byId=new Map<string,ReportPayment[]>();for(const p of payments){const list=byId.get(p.invoice_id)??[];list.push(p);byId.set(p.invoice_id,list)}
 return invoices.map(invoice=>{const events=byId.get(invoice.id)??[];const currency=String(invoice.currency??'').toUpperCase();const amount=Number(invoice.amount);const invalid=!currency||invoice.amount==null||!Number.isFinite(amount)||amount<0||events.some(p=>p.amount==null||!Number.isFinite(Number(p.amount))||Number(p.amount)<=0||String(p.currency).toUpperCase()!==currency);
 const gross=invalid?null:Math.round(amount*100);const paid=invalid?null:events.reduce((sum,p)=>sum+Math.round(Number(p.amount)*100),0);
 const excluded=['Draft','Cancelled'].includes(invoice.status);const balance=gross==null||paid==null?null:gross-paid;
 const issue=invalid?'Invalid amount or currency mismatch':excluded&&paid!==0?'Payment on draft/cancelled invoice':!excluded&&invoice.payment_status==='refunded'?'Refund requires independent reconciliation':!excluded&&balance!=null&&balance<0?'Overpayment':!excluded&&(invoice.status==='Paid'||invoice.payment_status==='paid')&&balance!==0?'Paid status without matching settlements':!excluded&&balance===0&&invoice.status!=='Paid'&&invoice.payment_status!=='paid'?'Settled amount, status not paid':null;
 return {...invoice,events,gross,paid,balance,excluded,issue};});
}
