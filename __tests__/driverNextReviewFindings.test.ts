import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
const book=fs.readFileSync('driver-pwa-next/src/BookingWorkspace.tsx','utf8');
const app=fs.readFileSync('driver-pwa-next/src/ReserveApp.tsx','utf8');
describe('14 November user video regressions',()=>{
 it('distinguishes backend Delivered from a server-recorded POD in booking header',()=>{
  expect(book).toContain("job.status==='DELIVERED' ? 'POD PENDING'");
  expect(book).toContain("podRecorded ? 'POD RECORDED'");
 });
 it('does not persist quote API errors across quotation category navigation',()=>{
  expect(app).toContain("setQuoteSection(s);setWithdrawId(null);setError('')");
 });
});
