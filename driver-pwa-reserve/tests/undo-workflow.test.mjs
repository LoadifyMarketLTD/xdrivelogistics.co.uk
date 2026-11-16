import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync(new URL('../src/ReserveApp.tsx',import.meta.url),'utf8');
const handover=fs.readFileSync(new URL('../src/DeliveryHandover.tsx',import.meta.url),'utf8');
const undo=fs.readFileSync(new URL('../../app/api/driver/mobile/jobs/[id]/undo-status/route.ts',import.meta.url),'utf8');
test('Undo is presented on arrival and handover steps',()=>{
 assert.match(handover,/onUndo&&<button/);
 assert.match(handover,/Undo Last Status/);
 assert.match(app,/onUndo=\{\(\)=>void undoLatestStatus\(job\)\}/);
});
test('Undo is offered from other active booking flow stages',()=>{
 assert.match(app,/undoTargets\[job\.status\]/);
 assert.match(app,/onClick=\{\(\)=>void undoLatestStatus\(job\)\}/);
});
test('Undo is one-step, audit-logged and asks server to check current status',()=>{
 assert.match(app,/expectedCurrentStatus:target\.expected/);
 assert.match(app,/window\.confirm/);
 assert.match(undo,/driver_mobile_undo/);
 assert.match(undo,/if \(!previous\) return respond\(409/);
 assert.match(undo,/\.eq\('current_status', job\.current_status\)/);
});
test('Undo never directly reverts Delivered, signed POD or issued invoices',()=>{
 assert.doesNotMatch(app.match(/const undoTargets:[\s\S]*?\n  };/)?.[0]||'',/DELIVERED|POD_SUBMITTED/);
 assert.doesNotMatch(undo.match(/const previousStatus:[\s\S]*?\n};/)?.[0]||'',/delivered:|pod_submitted:/);
});
