import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildInvoicePdf } from '../lib/server/invoicePdf';
const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1sAAAAASUVORK5CYII=', 'base64'));
const input = { invoiceNumber:'INV-TEST',jobReference:'XDL-TEST',invoiceDate:'2026-10-18',dueDate:'2026-11-01',issuerName:'Carrier test fixture',clientName:'Buyer test fixture',netAmount:100,vatAmount:0,vatRate:0,totalAmount:100,currency:'GBP',paymentTerms:'14 days' };
describe('real PDF evidence rendering',()=>{
 it('keeps the commercial invoice compact and appends all image evidence after the invoice',async()=>{
  const bytes=await buildInvoicePdf({...input,signatureAttestation:'Recipient typed-name attestation: Test Recipient. Confirmed: 2026-10-18T08:00:00Z. Evidence: supplier/job/photos/pod.png',evidenceImages:Array.from({length:5},(_,i)=>({bytes:png,label:`POD ${i+1}`}))});
  const pdf=await PDFDocument.load(bytes);expect(pdf.getPageCount()).toBe(7);
  fs.writeFileSync(join(tmpdir(),'xdrive-pod-invoice-sample.pdf'),bytes);
 });
 it('appends an uploaded POD PDF without trying to render it as an image',async()=>{
  const source=await PDFDocument.create();source.addPage([595,842]);
  const result=await buildInvoicePdf({...input,evidenceImages:[{bytes:await source.save(),label:'POD document'}]});
  expect((await PDFDocument.load(result)).getPageCount()).toBe(2);
 });
 it('refuses to silently omit corrupt image evidence',async()=>{
  await expect(buildInvoicePdf({...input,evidenceImages:[{bytes:new Uint8Array([1,2,3]),label:'POD'}]})).rejects.toThrow('valid PNG or JPEG');
 });
});
