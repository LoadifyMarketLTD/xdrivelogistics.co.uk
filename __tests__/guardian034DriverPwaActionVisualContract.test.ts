import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,it,expect} from 'vitest';
const file=(p:string)=>readFileSync(join(process.cwd(),p),'utf8');
describe('Guardian 034 — Driver PWA operational cards and Return Journey',()=>{
it('uses the same 50px action height without changing button meanings or colors',()=>{
const css=file('driver-pwa-reserve/src/ReserveApp.css');
const src=file('driver-pwa-reserve/src/ReserveApp.tsx');
expect(css).toContain('.rv-job .rv-actions button,');
expect(css).toContain('.rv-job .rv-booking-actions > button.rv-wide');
expect(css).toContain('min-height:50px;');
expect(css).toContain('height:50px;');
for(const action of ['Load Details','Quote Now','Edit Quote','Withdraw Quote','View Booking Details','Create Invoice'])expect(src).toContain(action);
expect(css).toContain('.rv-job .rv-actions .rv-load-details-action{background:#173653');
expect(css).toContain('.rv-job .rv-actions .rv-quote-now-action{background:#167653');
});
it('presents human notes, preserves machine metadata, and warns of expired availability',()=>{
const src=file('driver-pwa-reserve/src/ReturnJourneyPwa.tsx');
expect(src).toContain("parsed.source==='xdrive_return_exchange_v2'");
expect(src).toContain('return JSON.stringify({...parsed,notes:note})');
expect(src).toContain('readJourneyNotes(journey?.notes)');
expect(src).toContain('writeJourneyNotes(journey?.notes,notes.trim())');
expect(src).toContain('This return availability has expired.');
expect(src).toContain('xd-return-journey-form');
});
it('styles the fields and buttons in a self-contained responsive grid',()=>{
const css=file('driver-pwa-reserve/src/OriginalMorePwa.css');
expect(css).toContain('.xd-native-more .xd-return-journey-form');
expect(css).toContain('grid-template-columns:minmax(0,1fr)');
expect(css).toContain('.xd-return-action-primary');
expect(css).toContain('min-height:52px');
});
});
