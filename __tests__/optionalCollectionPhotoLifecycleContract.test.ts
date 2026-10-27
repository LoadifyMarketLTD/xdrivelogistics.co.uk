import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const read=(p:string)=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
describe('optional collection photography, mandatory delivery POD',()=>{
 it('does not require a pickup photo in driver UI or handover endpoints',()=>{
  const ui=read('app/components/workspace/DriverJobExecutionPage.tsx');
  expect(ui).not.toContain('At least one collection photo is required before the job can be marked loaded.');
  for(const p of ['app/api/driver/web/jobs/[id]/handover/route.ts','app/api/driver/mobile/jobs/[id]/handover/route.ts']){
   const api=read(p);expect(api).not.toContain('At least one collection photo is required.');expect(api).toContain('collection_handover: handover');
  }
 });
 it('removes pickup photo database gates while retaining handover verification',()=>{
  const sql=read('supabase/migrations/20261027231500_optional_pickup_photos_mandatory_handover.sql');
  expect(sql).toContain('A verified collection handover is required');
  expect(sql).not.toContain('At least one verified collection photo is required');
  expect(sql).not.toContain('A loading photo is required');
  expect(sql).toContain('At least one delivery photo is required.');
 });
 it('still blocks final POD without photo and recipient signature',()=>{
  const api=read('app/api/driver/web/jobs/[id]/[action]/route.ts');
  expect(api).toContain('At least one delivery photo is required for POD.');
  expect(api).toContain('Recipient signature is required for POD.');
 });
});