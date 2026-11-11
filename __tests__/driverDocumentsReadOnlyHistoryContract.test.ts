import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';

const route=readFileSync(join(process.cwd(),'app/api/driver/documents/route.ts'),'utf8');
const get=route.split('export async function GET(')[1]?.split('export async function POST(')[0]??'';
const post=route.split('export async function POST(')[1]??'';

describe('Owner Driver compliance document retention',()=>{
 it('GET is read-only and returns every historical document without deleting expired files',()=>{
  expect(get).toContain(".from('driver_documents')");
  expect(get).toContain(".eq('driver_id', driver.driverId)");
  expect(get).toContain("documents: data ?? []");
  expect(get).toContain('driverId: driver.driverId');
  expect(get).toContain('companyId: driver.companyId');
  expect(get).not.toContain('purge');
  expect(get).not.toContain('.remove(');
  expect(get).not.toContain('.delete(');
 });
 it('registering a new document does not destroy older uploads or database rows',()=>{
  expect(post).toContain('.insert({');
  expect(post).toContain("doc_type: docType");
  expect(post).not.toContain('purgeExpired');
  expect(post).not.toContain('purgeReplaced');
  expect(post).not.toContain('.delete()');
 });
 it('renders every real document record, not only the three current compliance slots',()=>{
  const page=readFileSync(join(process.cwd(),'app/driver/documents/page.tsx'),'utf8');
  expect(page).toContain('Uploaded document history');
  expect(page).toContain('docs.map((document)');
  expect(page).toContain('setDriverId(payload.driverId ?? null)');
  expect(page).not.toContain(".from('drivers')");
  expect(page).not.toContain('Expired and replaced copies are removed automatically');
 });
 it('removes only newly-uploaded invalid file objects, never stored historical documents',()=>{
  expect(route).not.toContain('deleteDriverDocumentRows');
  expect(route).not.toContain('purgeExpiredDriverDocuments');
  expect(route).not.toContain('purgeReplacedDriverDocuments');
  expect(post).toContain('await removeStoredObject(storagePath)');
 });
});
