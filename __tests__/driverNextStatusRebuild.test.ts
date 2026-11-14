import fs from 'node:fs';
import {describe,expect,it} from 'vitest';
const workspace=fs.readFileSync('driver-pwa-next/src/BookingWorkspace.tsx','utf8');
const summary=fs.readFileSync('driver-pwa-next/src/BookingStatusSummary.tsx','utf8');
const css=fs.readFileSync('driver-pwa-next/src/BookingStatusLayout.css','utf8');
describe('Driver NEXT Status tab reconstruction',()=>{
 it('always renders an operational status summary when Status selected',()=>{
  expect(workspace).toContain("section === 'status' && <BookingStatusSummary job={job} onMap={onMap}/>");
  expect(summary).toContain('Current booking status');
  expect(summary).toContain('POD pending — delivery not finalised');
  expect(summary).toContain('Delivered — signed POD recorded');
  expect(summary).toContain('POD');
 });
 it('does not replace the status timeline with invoice screen',()=>{
  expect(workspace).toContain('xb-status-finance-columns');
  expect(workspace).toContain('Booking status and finance');
  expect(workspace).toContain('StatusProgress job={job} session={session} onSession={onSession} onOperate={onOperate} operationsAllowed={false}');
  expect(workspace).toContain('Documents &amp; Finance');
 });
 it('keeps timeline and document access separate',()=>{
  expect(workspace).toContain('Booking status timeline');
  expect(workspace).toContain('Open POD & Invoice');
  expect(summary).toContain('PAYMENT TERMS');
  expect(summary).toContain('AGREED RATE');
  expect(summary).toContain('View route on map');
 });
 it('expands operational status on desktop without changing mobile navigation',()=>{
  expect(css).toContain('.xb-status-columns');
  expect(css).toContain('@media(min-width:950px)');
  expect(css).toContain('.rv-shell:has(.xb-status-overview)');
 });
});
