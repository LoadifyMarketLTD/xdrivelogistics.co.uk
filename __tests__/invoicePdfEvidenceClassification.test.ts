import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { isUnrelatedXDriveInvoicePdf } from '../lib/server/podEvidenceClassification';

describe('Invoice + POD appendix evidence filtering', () => {
  it('excludes an unrelated prior XDrive invoice uploaded as POD evidence', () => {
    const path = '3754b8fd-2ee1-42cf-a172-309058c5dc04/090cd41c-b6d7-43b5-bfe9-20126bc65004/documents/c11c6dc9-0f5b-4525-9e22-5b059bd56203-xdrive-invoice-5aff6d7c.pdf';
    expect(isUnrelatedXDriveInvoicePdf(path)).toBe(true);
    expect(isUnrelatedXDriveInvoicePdf('company/job/documents/XDrive-INV-202611-002.pdf')).toBe(true);
  });
  it('preserves genuine delivery photographs and POD PDFs', () => {
    expect(isUnrelatedXDriveInvoicePdf('company/job/photos/delivery-camera.jpg')).toBe(false);
    expect(isUnrelatedXDriveInvoicePdf('company/job/documents/signed-pod.pdf')).toBe(false);
    expect(isUnrelatedXDriveInvoicePdf('company/job/documents/hand-over-note.pdf')).toBe(false);
    expect(isUnrelatedXDriveInvoicePdf('company/job/documents/invoice-copy.jpg')).toBe(false);
  });
  it('PDF context filters only recognised unrelated billing PDFs after ownership validation', () => {
    const source = fs.readFileSync('lib/server/invoicePdfContext.ts','utf8');
    expect(source).toContain("image.label === 'POD' && isUnrelatedXDriveInvoicePdf(image.path)");
    expect(source.indexOf('POD evidence does not belong')).toBeLessThan(source.indexOf('isUnrelatedXDriveInvoicePdf(image.path)'));
  });
});
