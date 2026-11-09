import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildInvoicePdf } from '../lib/server/invoicePdf';

const image = new Uint8Array(fs.readFileSync('official-driver-pwa/tests/pod-test.png'));
const base = {
  invoiceNumber: 'TEST-INV-1199',
  jobReference: 'TEST-JOB-1199',
  invoiceDate: '2026-11-09',
  dueDate: '2026-12-31',
  issuerName: 'TEST CARRIER ONLY',
  issuerAddress: 'TEST ADDRESS',
  clientName: 'TEST CUSTOMER ONLY',
  clientAddress: 'TEST CUSTOMER ADDRESS',
  pickupLocation: 'Blackburn BB1',
  deliveryLocation: 'Leeds LS1',
  recipientName: 'TEST RECIPIENT',
  serviceDescription: 'Test courier transport',
  netAmount: 70,
  vatAmount: 0,
  vatRate: 0,
  vatTreatment: 'not_registered' as const,
  totalAmount: 70,
  currency: 'GBP',
  paymentTerms: 'End of calendar month',
};

describe('real invoice PDF renderer with POD appendices', () => {
  it('generates A4 invoice and separate signature and photographic evidence pages', async () => {
    const bytes = await buildInvoicePdf({ ...base,
      signatureAttestation: 'TEST RECIPIENT signed at delivery (synthetic test only)',
      evidenceImages: [{ bytes: image, label: 'Delivery photo - synthetic fixture' }],
    });
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(3);
    for (const page of document.getPages()) {
      expect(page.getWidth()).toBeCloseTo(595.28, 1);
      expect(page.getHeight()).toBeCloseTo(841.89, 1);
    }
    expect(bytes.byteLength).toBeGreaterThan(1500);
  });

  it('embeds a drawn signature image and a delivery photo as separate A4 appendices', async () => {
    const bytes = await buildInvoicePdf({ ...base,
      evidenceImages: [
        { bytes: image, label: 'Recipient signature - synthetic fixture' },
        { bytes: image, label: 'Delivery photo - synthetic fixture' },
      ],
    });
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(3);
    expect(document.getPages().every(page => Math.abs(page.getWidth() - 595.28) < 1 && Math.abs(page.getHeight() - 841.89) < 1)).toBe(true);
  });
  it('does not invent a signature or evidence appendix when none is provided', async () => {
    const bytes = await buildInvoicePdf({ ...base, evidenceImages: [], signatureAttestation: null });
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(1);
  });
});