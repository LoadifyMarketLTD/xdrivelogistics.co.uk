import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import {
  buildBookingAttachments,
  buildPodSummaryAttachment,
  buildRemittanceAdviceAttachment,
} from '../supabase/functions/notify-operational-event/documentPdf';

const decodeBase64 = (value: string) => Uint8Array.from(Buffer.from(value, 'base64'));

describe('operational email PDF documents', () => {
  it('creates valid booking confirmation and delivery note PDFs', async () => {
    const attachments = buildBookingAttachments({
      reference: 'QC-LV-336098',
      statusLabel: 'Booking Confirmation',
      buyerName: 'Quickline Logistics Limited',
      carrierName: 'XDrive Logistics Ltd',
      pickup: 'Widnes, WA8 5RZ',
      pickupDateTime: '15 Oct 2026, 13:35',
      delivery: 'Clitheroe, BB7 3BY',
      deliveryDateTime: '15 Oct 2026, 15:30',
      customerReference: 'QC-LV-336098',
      vehicle: 'Small Van',
      cargo: 'General freight',
      distanceMiles: 52.3,
      agreedRate: 45,
      currency: 'GBP',
      paymentTerms: '30 Days End Of Month',
      notes: 'Photos required on collection and delivery.',
    });

    expect(attachments).toHaveLength(2);
    expect(attachments.map((item) => item.filename)).toEqual([
      'QC-LV-336098_booking_confirmation.pdf',
      'QC-LV-336098_delivery_note.pdf',
    ]);

    for (const attachment of attachments) {
      expect(attachment.content_type).toBe('application/pdf');
      const bytes = decodeBase64(attachment.content);
      expect(Buffer.from(bytes.subarray(0, 8)).toString('ascii')).toBe('%PDF-1.4');
      const pdf = await PDFDocument.load(bytes);
      expect(pdf.getPageCount()).toBe(1);
    }
  });

  it('creates a valid remittance advice PDF', async () => {
    const attachment = buildRemittanceAdviceAttachment({
      invoiceNumber: 'INV-2026-001847',
      supplierName: 'XDrive Logistics Ltd',
      customerName: 'Controlled Customer',
      paymentDate: '18 Oct 2026, 23:30',
      amount: 84,
      currency: 'GBP',
      paymentReference: 'PAY-TEST-847',
      settlementMethod: 'bank transfer',
    });
    expect(attachment.filename).toBe('INV-2026-001847_remittance.pdf');
    const bytes = decodeBase64(attachment.content);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
  });

  it('creates a valid POD summary PDF', async () => {
    const attachment = buildPodSummaryAttachment({
      reference: 'QC-LV-336098',
      pickup: 'WA8 5RZ',
      delivery: 'BB7 3BY',
      deliveredOn: '15 Oct 2026, 15:41',
      receivedBy: 'STUART A',
      leftAt: 'Goods Inwards',
      deliveryStatus: 'Completed Delivery',
      itemCount: 1,
      deliveryNotes: 'Delivered in good condition.',
    });

    expect(attachment.filename).toBe('QC-LV-336098_POD.pdf');
    const bytes = decodeBase64(attachment.content);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
  });
});
