import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs';
import sharp from 'sharp';
import { buildInvoicePdf } from '../lib/server/invoicePdf';

describe('Approved Invoice + POD pair in the real billing renderer', () => {
  it('creates invoice, matching professional signed POD, then evidence without a duplicated signature page', async () => {
    const signatureBytes = await sharp(Buffer.from('<svg width="450" height="120" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/><path d="M20 70 Q90 0 130 68 T260 40 Q310 0 420 65" stroke="#0c2859" stroke-width="5" fill="none"/></svg>')).png().toBuffer();
    const photo = await sharp({create:{width:850,height:550,channels:3,background:{r:200,g:207,b:217}}}).jpeg().toBuffer();
    const signature='data:image/png;base64,'+signatureBytes.toString('base64');
    const bytes=await buildInvoicePdf({
      invoiceNumber:'INV-202611-003',invoiceDate:'2026-11-09',dueDate:'2026-11-30',
      issuerName:'XDrive Logistics',clientName:'Customer - visual preview',
      jobReference:'XDL-090CD41C',netAmount:17,vatAmount:0,vatRate:0,
      vatTreatment:'not_registered',totalAmount:17,currency:'GBP',
      pickupLocation:'Cornelian Street, Blackburn, BB1 9QL',
      deliveryLocation:'Holly Hill Road, Bexley, DA8 1QD',
      podDetails:{
        id:'090cd41c-b6d7-43b5-bfe9-20126bc65004',
        pickup_location:'Cornelian Street, Blackburn, BB1 9QL',
        delivery_location:'Holly Hill Road, Bexley, DA8 1QD',
        pickup_datetime:'2026-11-09T12:30:00Z',delivered_at:'2026-11-09T20:24:04Z',
        pod_generated_at:'2026-11-09T20:24:04Z',client_signature_name:'XDrive Logistics',
        no_of_items:2,vehicle_type:'Luton van',
      },podHandover:{leftAt:'Goods Inwards',itemCount:2,deliveryStatus:'Good condition'},
      podSignatureDataUrl:signature,podDeliveryPhotoCount:1,
      evidenceImages:[{label:'Delivery',bytes:photo},{label:'Signature',bytes:signatureBytes}],
    });
    const pdf=await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(3);
    expect(pdf.getPages().every(p=>Math.abs(p.getSize().width-595.28)<1 && Math.abs(p.getSize().height-841.89)<1)).toBe(true);
    fs.writeFileSync('approved-invoice-pod-pair-qa.pdf',bytes);
  });
  it('uses the 30-day default when invoice payment terms are missing', async()=>{
    const source=fs.readFileSync('lib/server/invoicePdf.ts','utf8');
    expect(source).toContain("pdfText(input.paymentTerms,'30 days')");
    expect(source).not.toContain("pdfText(input.paymentTerms,'14 days')");
  });
  it('without a verified signed POD leaves a one-page invoice unchanged',async()=>{
    const bytes=await buildInvoicePdf({
      invoiceNumber:'INV-DRAFT-PREVIEW',invoiceDate:'2026-11-09',dueDate:'2026-11-30',
      issuerName:'XDrive Logistics',clientName:'Customer',netAmount:17,vatAmount:0,
      vatRate:0,vatTreatment:'not_registered',totalAmount:17,currency:'GBP',
    });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
  it('preview and email both pass the exact same authoritative signed POD fields',()=>{
    for(const path of ['app/api/driver/finance/invoices/[id]/preview/route.ts','lib/server/invoiceDelivery.ts']){
      const s=fs.readFileSync(path,'utf8');
      for(const key of ['podDetails','podHandover','podSignatureDataUrl','podDeliveryPhotoCount']){
        expect(s).toContain(key+': pdfContext.'+key);
      }
    }
    const source=fs.readFileSync('lib/server/invoicePdfContext.ts','utf8');
    expect(source).toContain('if (signedPodConfirmed)');
    expect(source).toContain('if (jobId && signedPodConfirmed)');
    expect(source).toContain('podSignatureDataUrl = value');
  });
});
