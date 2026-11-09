import {describe,it,expect} from 'vitest';
import {isUnrelatedXDriveInvoicePdf} from '../lib/server/podEvidenceClassification';
import fs from 'node:fs';
describe('delivery evidence never embeds a previous XDrive invoice',()=>{
 it('filters known older invoice PDF path but preserves real POD evidence',()=>{
  expect(isUnrelatedXDriveInvoicePdf('company/job/documents/c11c6dc9-xdrive-invoice-5aff6d7c.pdf')).toBe(true);
  expect(isUnrelatedXDriveInvoicePdf('company/job/documents/XDrive-INV-202611-002.pdf')).toBe(true);
  expect(isUnrelatedXDriveInvoicePdf('company/job/documents/signed-pod.pdf')).toBe(false);
  expect(isUnrelatedXDriveInvoicePdf('company/job/photos/delivery-photo.jpg')).toBe(false);
 });
 it('keeps the original evidence in storage and only filters PDF generation after ownership checks',()=>{
  const source=fs.readFileSync('lib/server/invoicePdfContext.ts','utf8');
  expect(source).toContain("image.label === 'POD' && isUnrelatedXDriveInvoicePdf(image.path)");
  expect(source.indexOf('POD evidence does not belong')).toBeLessThan(source.indexOf('isUnrelatedXDriveInvoicePdf(image.path)'));
 });
});
