import fs from 'node:fs';
import {describe,expect,it} from 'vitest';
const source=fs.readFileSync('driver-pwa-next/src/BookingWorkspace.tsx','utf8');
const style=fs.readFileSync('driver-pwa-next/src/BookingCXStatus.css','utf8');
describe('Driver NEXT CX referenced booking status structure',()=>{
 it('shows Summary Stops Status with just one Status timeline',()=>{
  expect(source).toContain("(['summary','stops','status'] as const)");
  expect(source).toContain('<StatusProgress job={job}');
  expect(source).not.toContain('<BookingStatusSummary');
  expect(source).toContain("index<=current && stage.key!=='INVOICE'");
  expect(source).toContain(".slice().reverse().map(stage =>");
 });
 it('shows a separate POD operation, never a side-by-side timeline and form',()=>{
  expect(source).toContain('mode === \'operation\' && !podRecorded');
  expect(source).toContain('aria-label="Current booking operation"');
  expect(source).toContain('Delivered (POD)');
  expect(source).toContain('xb-cx-continue');
 });
 it('removes unrelated dashboard metrics and desktop two-column layout',()=>{
  expect(source).not.toContain('xb-status-columns');
  expect(source).not.toContain('XDRIVE TRANSPORT STATUS');
  expect(style).toContain('max-width:760px');
 });
});
