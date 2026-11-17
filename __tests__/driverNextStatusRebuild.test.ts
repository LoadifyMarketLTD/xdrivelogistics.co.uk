import fs from 'node:fs';
import {describe,expect,it} from 'vitest';
const workspace=fs.readFileSync('driver-pwa-next/src/BookingWorkspace.tsx','utf8');
const css=fs.readFileSync('driver-pwa-next/src/BookingCXStatus.css','utf8');
describe('Driver NEXT booking Status — CX reference',()=>{
 it('uses Summary, Stops and Status without any additional dashboard summary',()=>{
  expect(workspace).toContain("(['summary','stops','status'] as const)");
  expect(workspace).not.toContain('BookingStatusSummary');
  expect(workspace).not.toContain('xb-status-overview');
 });
 it('shows recent confirmed stages first and preserves source timestamps',()=>{
  expect(workspace).toContain('.slice().reverse().map(stage =>');
  expect(workspace).toContain('timestamp(event.at)');
  expect(workspace).toContain("'Delivered (POD)'");
 });
 it('opens the POD form as a separate full-width operation instead of splitting the timeline',()=>{
  expect(workspace).toContain("mode === 'operation' && !podRecorded");
  expect(workspace).toContain('aria-label="Current booking operation"');
  expect(workspace).toContain('xb-cx-continue');
  expect(workspace).not.toContain('xb-status-columns');
 });
 it('offers official documents only after POD is recorded and keeps Invoice separate',()=>{
  expect(workspace).toContain('{podRecorded && <div className="xb-cx-documents">');
  expect(workspace).toContain('View POD &amp; Invoice');
  expect(workspace).toContain('mode === \'finance\'');
 });
 it('uses the same single-column layout on desktop and mobile',()=>{
  expect(css).toContain('max-width:760px');
  expect(css).toContain('.xb-cx-status .xb-timeline');
  expect(css).toContain('@media(min-width:950px)');
 });
});
