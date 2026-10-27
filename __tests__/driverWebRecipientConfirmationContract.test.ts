import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const route = fs.readFileSync(path.join(process.cwd(),'app/api/driver/web/jobs/[id]/confirmation/route.ts'),'utf8');
describe('driver web recipient confirmation contract',()=>{
 it('requires an active authenticated web driver',()=>{
  expect(route).toContain('requireActiveWebDriver');
  expect(route).toContain('isWebDriverContext');
 });
 it('rejects typed-name attestation as a substitute for a handwritten POD signature',()=>{
  expect(route).toContain('Capture a handwritten recipient signature in the POD form.');
  expect(route).not.toContain('typed_name_attestation');
  expect(route).not.toContain('delivery_signature_data: confirmation');
 });
});