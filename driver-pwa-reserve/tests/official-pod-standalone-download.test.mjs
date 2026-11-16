import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');

test('Reserve exposes a separate official signed POD A4 download only after verified POD', () => {
  const app = read('../src/ReserveApp.tsx');
  assert.match(app, /if\(job\.podRecorded\|\|podDone\)return/);
  assert.match(app, /<OfficialPodDownload jobId=\{job\.id\} session=\{session\}/);
  const completed=app.slice(app.indexOf('if(job.podRecorded||podDone)return'));
  assert.ok(completed.includes('<OfficialPodDownload')&&completed.includes('Create / View Invoice'));
  assert.ok(completed.indexOf('<OfficialPodDownload')<completed.indexOf('Create / View Invoice'));
});
test('official POD download is read-only and uses authenticated XDrive backend', () => {
  const src = read('../src/OfficialPodDownload.tsx');
  assert.match(src, /renewSession\(session\)/);
  assert.match(src, /\/workspace\/jobs\//);
  assert.match(src, /\/pod\/pdf/);
  assert.match(src, /Authorization: 'Bearer ' \+ fresh\.token/);
  assert.match(src, /application\/pdf/);
  assert.match(src, /file\.size < 1000/);
  assert.match(src, /'XDrive-' \+ jobId \+ '-POD\.pdf'/);
  assert.doesNotMatch(src, /method:\s*'POST'|method:\s*'PUT'|generate-invoice|submitInvoice/);
});
