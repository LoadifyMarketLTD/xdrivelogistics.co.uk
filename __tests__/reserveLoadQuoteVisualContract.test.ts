import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,it,expect} from 'vitest';
const source=readFileSync(join(process.cwd(),'driver-pwa-reserve/src/ReserveApp.tsx'),'utf8');
const css=readFileSync(join(process.cwd(),'driver-pwa-reserve/src/ReserveApp.css'),'utf8');
describe('Driver PWA load detail and quote visual parity',()=>{
 it('preserves original Loads listing card and primary actions',()=>{
  expect(source).toContain('function card(j:LiveJob');
  expect(source).toContain('rv-load-details-action');
  expect(source).toContain('rv-quote-now-action');
  expect(source).toContain("open(j,'details')");
  expect(source).toContain("open(j,'quote')");
 });
 it('renders commercial and operational data in a dedicated compact load detail',()=>{
  expect(source).toContain('className="rv-load-detail"');
  expect(source).toContain('Load requirements');
  expect(source).toContain('Instructions & references');
  expect(source).toContain('Payment & terms');
  expect(source).toContain("openMap(job,'details')");
  expect(source).toContain('job.notes?.trim()');
 });
 it('keeps the authenticated quote submit/edit endpoint and amounts intact',()=>{
  expect(source).toContain('className="rv-load-quote"');
  expect(source).toContain('inputMode="decimal"');
  expect(source).toContain('aria-label="Your total quote in GBP"');
  expect(source).toContain("driverPost('/mobile/bids'");
  expect(source).toContain("driverPost('/mobile/bids/'+encodeURIComponent(job.bidId!)");
  expect(source).toContain('collectWithinMinutes:minutes');
  expect(source).toContain('message:quoteNotes.trim()');
  expect(source).toContain('disabled={busy||!(Number(quoteAmount)>0)}');
 });
 it('scopes styles to detail and quote, not the Loads card list or site header',()=>{
  expect(css).toContain('/* Premium load details & quotation.');
  expect(css).toContain('.rv-load-overview');
  expect(css).toContain('.rv-load-quote-form');
  expect(css).toContain('.rv-load-money-input');
 });
});
