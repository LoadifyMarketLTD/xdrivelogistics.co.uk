import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,it,expect} from 'vitest';
const file=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

describe('Guardian 034 — consistent Driver PWA operational card actions',()=>{
  it('keeps Loads as the 50px height reference across Quotes and Bookings',()=>{
    const css=file('driver-pwa-reserve/src/ReserveApp.css');
    const src=file('driver-pwa-reserve/src/ReserveApp.tsx');
    expect(css).toContain('.rv-job .rv-actions button,');
    expect(css).toContain('.rv-job .rv-booking-actions > button.rv-wide');
    expect(css).toContain('min-height:50px;');
    expect(css).toContain('height:50px;');
    for(const label of ['Load Details','Quote Now','Edit Quote','Withdraw Quote','View Booking Details','Create Invoice']){
      expect(src).toContain(label);
    }
    expect(css).toContain('.rv-job .rv-actions .rv-load-details-action{background:#173653');
    expect(css).toContain('.rv-job .rv-actions .rv-quote-now-action{background:#167653');
    expect(css).toContain('white-space:normal;');
  });
});
