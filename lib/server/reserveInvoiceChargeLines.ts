import type { SupabaseClient } from '@supabase/supabase-js';

type Row=Record<string,unknown>;
export type InvoiceChargeLine={id:string;description:string;amount:number};
export type InvoiceChargeBreakdown={transportAmount:number;charges:InvoiceChargeLine[]};
const asRow=(value:unknown):Row=>value&&typeof value==='object'&&!Array.isArray(value)?value as Row:{};
const text=(value:unknown)=>typeof value==='string'?value.trim():'';
function cents(value:unknown){
 if(value===null||value===undefined||value===''||typeof value==='boolean')throw new Error('Invalid contractual amount.');
 const n=Number(value),p=Math.round(n*100);
 if(!Number.isFinite(n)||!Number.isSafeInteger(p)||Math.abs(n*100-p)>0.000001||p<0)throw new Error('Invalid contractual amount.');
 return p;
}
const labels:Record<string,string>={waiting_time:'Waiting time',handball:'Handball',parking:'Parking',toll:'Toll',other:'Additional charge'};
function sameSnapshot(snapshot:Row,extra:Row){
 return snapshot.extra_id===extra.id&&snapshot.job_id===extra.job_id&&snapshot.driver_id===extra.driver_id&&snapshot.supplier_company_id===extra.supplier_company_id&&snapshot.extra_type===extra.extra_type&&(snapshot.description??null)===(extra.description??null)&&cents(snapshot.amount_gbp)===cents(extra.amount_gbp)&&(snapshot.minutes??null)===(extra.minutes??null);
}
export function reconcileApprovedCharges(input:{invoice:Row;companyId:string;agreement:Row;extras:Row[];amendments:Row[]}):InvoiceChargeBreakdown|null{
 const {invoice,companyId,agreement,extras,amendments}=input;
 const approved=extras.filter(row=>['approved','invoiced'].includes(String(row.status)));
 if(!approved.length)return null;
 if(invoice.invoice_origin!=='marketplace'||invoice.company_id!==companyId||invoice.supplier_company_id!==companyId||invoice.currency!=='GBP'||agreement.currency!=='GBP'||agreement.agreement_status!=='accepted'||agreement.id!==invoice.commercial_agreement_id||agreement.job_id!==invoice.job_id||agreement.supplier_company_id!==companyId||agreement.buyer_company_id!==invoice.buyer_company_id||cents(invoice.net_amount)!==cents(agreement.agreed_amount))throw new Error('Invoice and accepted agreement do not reconcile.');
 const ids=new Set<string>(),links=new Set<string>();
 const list:InvoiceChargeLine[]=[];
 let charges=0;
 for(const extra of [...approved].sort((a,b)=>Number(a.contractual_snapshot_version)-Number(b.contractual_snapshot_version))){
  const id=text(extra.id),link=text(extra.contractual_amendment_id),version=Number(extra.contractual_snapshot_version);
  const snapshot=asRow(extra.contractual_snapshot),type=text(extra.extra_type);
  if(!id||ids.has(id)||!link||links.has(link)||extra.job_id!==invoice.job_id||extra.supplier_company_id!==companyId||!labels[type]||!Number.isInteger(version)||version<2||version>Number(agreement.contract_version)||!/^[0-9a-f]{64}$/.test(text(extra.contractual_snapshot_hash))||!sameSnapshot(snapshot,extra))throw new Error('Approved charge snapshot is incomplete or inconsistent.');
  const amendment=amendments.find(row=>row.id===link);
  if(!amendment||amendment.status!=='accepted'||amendment.agreement_id!==agreement.id||amendment.job_id!==invoice.job_id||amendment.currency!=='GBP'||Number(amendment.version_number)!==version||amendment.decided_by_company_id!==invoice.buyer_company_id)throw new Error('Charge lacks a verified buyer-approved amendment.');
  const summary=asRow(amendment.change_summary),change=asRow(summary.amount),linkedSnapshot=asRow(summary.execution_extra);
  const amount=cents(extra.amount_gbp);
  if(amount<=0||!sameSnapshot(linkedSnapshot,extra)||cents(change.to)-cents(change.from)!==amount||cents(amendment.effective_agreed_amount)!==cents(change.to))throw new Error('Approved charge does not reconcile with its amendment.');
  const minutes=extra.minutes==null?null:Number(extra.minutes);
  if(type==='waiting_time'&&(!Number.isInteger(minutes)||minutes!<1||minutes!>1440)||type!=='waiting_time'&&minutes!==null)throw new Error('Approved charge duration is invalid.');
  ids.add(id);links.add(link);charges+=amount;
  const description=labels[type]+(minutes?' ('+minutes+' min)':'')+(text(extra.description)?' - '+text(extra.description):'');
  list.push({id,description,amount:amount/100});
 }
 const net=cents(invoice.net_amount);
 if(net<=charges)throw new Error('Approved charges exceed or consume the transport value.');
 return {transportAmount:(net-charges)/100,charges:list};
}
export async function loadReserveApprovedChargeLines(supabase:SupabaseClient,invoice:Row,companyId:string):Promise<InvoiceChargeBreakdown|null>{
 if(invoice.invoice_origin!=='marketplace'||!text(invoice.job_id)||!text(invoice.commercial_agreement_id))return null;
 const jobId=text(invoice.job_id),agreementId=text(invoice.commercial_agreement_id);
 // Limit the new renderer to the designated Reserve QA pilot until live Finance acceptance.
 const job=await supabase.from('jobs').select('is_test').eq('id',jobId).maybeSingle();
 if(job.error)throw new Error('Invoice job identity could not be verified.');
 if(job.data?.is_test!==true)return null;
 const result=await supabase.from('driver_job_extras').select('id,job_id,driver_id,supplier_company_id,extra_type,description,amount_gbp,minutes,status,contractual_amendment_id,contractual_snapshot,contractual_snapshot_hash,contractual_snapshot_version').eq('job_id',jobId).eq('supplier_company_id',companyId).in('status',['approved','invoiced']);
 if(result.error)throw new Error('Approved execution charges could not be verified.');
 if(!result.data?.length)return null;
 const [agreement,amendments]=await Promise.all([
  supabase.from('job_commercial_agreements_effective').select('id,job_id,buyer_company_id,supplier_company_id,agreed_amount,currency,agreement_status,contract_version').eq('id',agreementId).eq('job_id',jobId).eq('supplier_company_id',companyId).eq('agreement_status','accepted').maybeSingle(),
  supabase.from('job_commercial_agreement_amendments').select('id,agreement_id,job_id,version_number,change_summary,effective_agreed_amount,currency,status,decided_by_company_id').eq('agreement_id',agreementId).eq('job_id',jobId).eq('status','accepted')
 ]);
 if(agreement.error||!agreement.data||amendments.error)throw new Error('Approved charge agreement evidence is unavailable.');
 return reconcileApprovedCharges({invoice,companyId,agreement:agreement.data,extras:result.data,amendments:amendments.data??[]});
}