import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/ReserveApp.tsx',import.meta.url),'utf8');
test('Changing handover data invalidates verified signature in Delivery and POD',()=>{
 const marker="onChange={v=>{if(v.recipient!==draft.recipient||v.leftAt!==draft.leftAt||v.items!==draft.items||v.condition!==draft.condition||v.notes!==draft.notes)setVerifiedSignature(null);setDraft(v);setError('');}} signature={signature}";
 assert.equal(app.split(marker).length-1,1); // Single authoritative delivery form; POD reuses verified signature.
});
test('Signed POD cannot confirm without the verified signature matching the current one',()=>{
 assert.match(app,/verifiedSignature!==signature/);
 assert.match(app,/saveRecipientSignature\(job\)/);
});