import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { drawOfficialPodCover } from '../lib/server/professionalPodPdf';

const fixtureJob = {
  id: 'db68930a-4488-430e-956b-27eb64f60297',
  reference: 'XDL-DB68930A',
  pickup_location: 'Blackburn, BB1 9QL, UK',
  delivery_location: 'Leeds, LS22 6FQ, UK',
  pod_generated_at: '2026-11-16T22:05:59Z',
  client_signature_name: 'QA TEST RECIPIENT',
  vehicle_type: 'Luton Tail Lift',
};

describe('official XDrive POD PDF', () => {
  it('renders verified typed-name attestation without manufacturing handwriting', async () => {
    const pdf = await PDFDocument.create();
    const logo = await readFile('public/xdrive-logo-primary.png');
    await drawOfficialPodCover(pdf, logo, 'XDrive Logistics Ltd', fixtureJob,
      { kind: 'typed_name_attestation', recipientName: 'QA TEST RECIPIENT', confirmedAt: '2026-11-16T14:00:13Z' },
      3, { deliveryStatus: 'Completed Delivery', itemCount: 4 },
    );
    const bytes = await pdf.save();
    expect(Buffer.from(bytes).toString('ascii', 0, 5)).toBe('%PDF-');
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
  it('retains existing handwritten image signature rendering path', async () => {
    const pdf = await PDFDocument.create();
    const logo = await readFile('public/xdrive-logo-primary.png');
    const drawn = 'data:image/png;base64,' + logo.toString('base64');
    await drawOfficialPodCover(pdf, logo, 'XDrive Logistics Ltd', fixtureJob, drawn, 1);
    const bytes = await pdf.save();
    expect(Buffer.from(bytes).toString('ascii', 0, 5)).toBe('%PDF-');
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
