import {describe,it,expect} from 'vitest';
import {reconcileOwnerPayments,type ReportInvoice} from '../app/driver/_components/ownerPaymentReconciliation';
const base:ReportInvoice={id:'i',invoice_number:'XD-1',client_name:'Member',status:'Sent',payment_status:'partially_paid',amount:100.01,currency:'GBP',due_date:null};
const p=(amount:number,currency='GBP')=>({invoice_id:'i',amount,currency});
describe('Owner payment reconciliation',()=>{
it('uses integer pence and recorded payments',()=>expect(reconcileOwnerPayments([base],[p(30.01),p(20)])[0]).toMatchObject({gross:10001,paid:5001,balance:5000,issue:null}));
it('flags an unsupported paid claim without recording a fictitious payment',()=>expect(reconcileOwnerPayments([{...base,status:'Paid',payment_status:'paid'}],[])[0]).toMatchObject({paid:0,issue:'Paid status without matching settlements'}));
it('flags overpayment and mismatched currency',()=>{expect(reconcileOwnerPayments([base],[p(101)])[0].issue).toBe('Overpayment');expect(reconcileOwnerPayments([base],[p(10,'EUR')])[0].balance).toBeNull()});
it('excludes drafts and cancelled records from receivable balances',()=>expect(reconcileOwnerPayments([{...base,status:'Cancelled'}],[p(2)])[0]).toMatchObject({excluded:true,issue:'Payment on draft/cancelled invoice'}));
});
