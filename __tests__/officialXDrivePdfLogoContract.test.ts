import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs';
import { drawOfficialXDrivePdfLogo, officialXDriveLogoBytes, OFFICIAL_XDRIVE_LOGO_FILENAME } from '../lib/server/officialXDrivePdfLogo';
import { buildInvoicePdf } from '../lib/server/invoicePdf';

describe('one official XDrive logo across newly generated documents', () => {
  it('uses the exact approved platform asset and embeds it proportionally in an A4 PDF', async () => {
    expect(OFFICIAL_XDRIVE_LOGO_FILENAME).toBe('xdrive-logo-primary.png');
    const source=fs.readFileSync('public/xdrive-logo-primary.png');
    const loaded=await officialXDriveLogoBytes();
    expect(Buffer.from(loaded)).toEqual(source);
    const pdf=await PDFDocument.create();
    const page=pdf.addPage([595.28,841.89]);
    await drawOfficialXDrivePdfLogo(pdf,page,{x:42,y:745,maxWidth:210,maxHeight:68});
    const bytes=await pdf.save();
    const output=await PDFDocument.load(bytes);
    expect(output.getPageCount()).toBe(1);
    expect(bytes.byteLength).toBeGreaterThan(20000);
  });
  it('always uses the platform logo rather than a carrier-provided logo on official invoice PDFs', async () => {
    const bytes=await buildInvoicePdf({
      invoiceNumber:'INV-LOGO-TEST',invoiceDate:'2026-11-09',dueDate:'2026-11-30',
      issuerName:'Test Carrier',clientName:'Test Recipient',netAmount:17,vatAmount:0,vatRate:0,
      vatTreatment:'not_registered',totalAmount:17,currency:'GBP',logoBytes:new Uint8Array([0,1,2,3]),
    });
    const doc=await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const src=fs.readFileSync('lib/server/invoicePdf.ts','utf8');
    expect(src).toContain('drawOfficialXDrivePdfLogo(pdf, page');
    expect(src).not.toContain('if (input.logoBytes?.length)');
  });
  it('includes the same asset across the official PDF and print template renderers',()=>{
    const paths=[
      'app/api/workspace/jobs/[jobId]/pod/pdf/route.ts',
      'app/api/billing/contract-confirmation/route.ts',
      'lib/legal/signedAgreementPdf.ts',
      'app/api/account/legal-agreements/[id]/signed-document/route.ts',
    ];
    for (const p of paths) expect(fs.readFileSync(p,'utf8')).toContain('drawOfficialXDrivePdfLogo(');
    for(const p of ['lib/invoicePdf.ts','app/components/InvoiceTemplate.tsx','app/customer/quotes/BookingConfirmationFullPage.tsx'])
      expect(fs.readFileSync(p,'utf8')).toContain('/xdrive-logo-primary.png');
    const signedRoute=fs.readFileSync('app/api/account/legal-agreements/[id]/signed-document/route.ts','utf8');
    expect(signedRoute).toContain('Original signed PDF');
    expect(signedRoute).toContain('createSignedUrl(agreement.signed_pdf_path');
  });
});
