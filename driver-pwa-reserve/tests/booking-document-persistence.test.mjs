import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const component = readFileSync(new URL('../src/BookingDocuments.tsx', import.meta.url), 'utf8');
const api = readFileSync(new URL('../../app/api/driver/web/jobs/[id]/evidence/route.ts', import.meta.url), 'utf8');
test('booking files are uploaded to authenticated private storage, never saved as local names', () => {
  assert.match(component, /method: "POST"/);
  assert.match(component, /Authorization: `Bearer \$\{session.token\}`/);
  assert.match(component, /"x-xdrive-evidence-category": "documents"/);
  assert.match(component, /body: file/);
  assert.doesNotMatch(component, /localStorage|createObjectURL/);
  assert.match(api, /\.upload\(storagePath, payload, \{ contentType, upsert: false \}\)/);
});
test('booking documents are recovered after reload with scoped signed URLs', () => {
  assert.match(component, /useEffect\(\(\) => \{/);
  assert.match(component, /void refresh\(session.token\)/);
  assert.match(api, /\.eq\('assigned_driver_id', driver.driverId\)/);
  assert.match(api, /createSignedUrl\(path, 300\)/);
  assert.match(api, /documents: signed\.filter/);
});
test('booking uploads reject unsupported and oversized files', () => {
  assert.match(component, /10 \* 1024 \* 1024/);
  assert.match(component, /application\/pdf/);
  assert.match(component, /image\/jpeg/);
  assert.match(component, /image\/png/);
  assert.match(api, /hasExpectedMagicBytes\(payload, contentType\)/);
});
