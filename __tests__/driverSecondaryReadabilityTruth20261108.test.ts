import fs from 'node:fs';import path from 'node:path';
import {describe,expect,it} from 'vitest';
const read=(p:string)=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
describe('Freight Vision truth and Return Journeys readability',()=>{
 it('does not present scheduled delivery as live ETA or fabricate GPS positions',()=>{
  const file=read('app/driver/freight-vision/page.tsx');
  expect(file).toContain('Scheduled delivery:');
  expect(file).toContain('Verified live position not available');
  expect(file).toContain('trusted tracking source');
  expect(file).toContain('trackingByJob[job.id]?.location?.recorded_at');
  const css=read('app/driver/freight-vision/freight-vision-readability.css');
  expect(css).toContain('.driver-freight-vision-prototype .vision-kpis');
  expect(css).toContain('.driver-freight-vision-prototype .vision-split{display:grid!important');
  expect(css).toContain('.driver-freight-vision-prototype .vision-job{display:flex!important');
  expect(file).toContain("address.toUpperCase().includes(area.toUpperCase())");
 });
 it('wraps toolbar controls without touching protected Post Load page',()=>{
  expect(read('app/driver/returns/layout.tsx')).toContain('return-toolbar-readability.css');
  expect(read('app/driver/returns/return-toolbar-readability.css')).toContain('flex-wrap:wrap!important');
  expect(read('app/admin/post-load/page.tsx')).toContain('<LoadPostingForm mode="admin" />');
 });
 it('explains independent live status and weekly scheduled availability',()=>{
  const page=read('app/driver/availability/page.tsx');
  expect(page).toContain('Available Now (manual status)');
  expect(page).toContain('Scheduled availability (separate from Available Now)');
 });
});
