import { describe, expect, it } from 'vitest';
import { toInvoiceProPresentation } from '../lib/invoiceProPresentationAdapter';
const invoice = {invoice_number:'INV-001',job_ref:'JOB-1',invoice_date:'2026-11-02',client_name:'Real client',amount:70,vat_rate:20,status:'Sent'};
describe('Invoice Pro read-only presentation mapping',()=>{
 it('preserves invoice identity, value and status',()=>{const x=toInvoiceProPresentation(invoice);expect(x.invoiceNo).toBe('INV-001');expect(x.jobRef).toBe('JOB-1');expect(x.total).toBe(84);expect(x.status).toBe('Sent')});
 it('uses stored monetary and due date fields',()=>{const x=toInvoiceProPresentation({...invoice,net_amount:80,vat_amount:0,due_date:'2026-11-30',vat_rate:0});expect(x.total).toBe(80);expect(x.dueDate).toBe('2026-11-30')});
 it('rejects corrupt monetary fields',()=>{expect(()=>toInvoiceProPresentation({...invoice,amount:NaN})).toThrow()});
});
it('shows a missing client as absent, not a fictional customer',()=>{const record={...invoice,client_name:''};expect(toInvoiceProPresentation(record).clientName).toBe('Client not recorded')});
