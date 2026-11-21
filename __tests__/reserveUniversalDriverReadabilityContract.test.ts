import fs from 'node:fs';
import path from 'node:path';
import {describe,expect,it} from 'vitest';

const read=(p:string)=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
const entry=read('driver-pwa-reserve/src/main.tsx');
const css=read('driver-pwa-reserve/src/DriverReadability.css');

describe('Driver Reserve PWA universal readability contract',()=>{
  it('loads a single accessibility layer after feature styles',()=>{
    expect(entry).toContain("import App from './ReserveApp.tsx'");
    expect(entry).toContain("import './DriverReadability.css'");
    expect(entry.indexOf("import './DriverReadability.css'")).toBeGreaterThan(entry.indexOf("import App from './ReserveApp.tsx'"));
  });
  it('scopes changes to the Driver PWA and retains existing brand header',()=>{
    expect(css).toContain('.rv-shell');
    expect(css).not.toMatch(/\.rv-header\s*\{/);
    expect(css).not.toMatch(/\.rv-official-logo\s*\{/);
    expect(css).not.toMatch(/\.rv-shell\s+\.rv-header\b/);
  });
  it('includes readable critical route and job information in all lists and details',()=>{
    expect(css).toContain('.rv-job .rv-route .rv-stop b');
    expect(css).toContain('.rv-load-detail .rv-route .rv-stop b');
    expect(css).toContain('.rv-history-card .rv-route .rv-stop b');
    expect(css).toContain('font-size:clamp(20px,5.2vw,24px)!important');
    expect(css).toContain('.rv-jobhead .rv-job-identity>strong');
    expect(css).toContain('.rv-job-service');
  });
  it('covers quotes, bookings, operation steps, POD and status history',()=>{
    for(const marker of ['.rv-load-quote-form','.rv-booking-decision-actions','.rv-booking-timeline','.rv-operation-screen','.rv-delivery-page','.rv-history-facts','.rv-booking-audit','.rv-collection-group']){
      expect(css).toContain(marker);
    }
  });
  it('covers Finance and invoice register including actionable controls',()=>{
    for(const marker of ['.xdi-finance','.xdi-invoice-meta','.xdi-download','.rv-finance','.rv-field','.rv-fact']){
      expect(css).toContain(marker);
    }
  });
  it('ensures readable input sizes, full-width actions and keyboard focus',()=>{
    expect(css).toContain('font-size:17px!important;line-height:1.4!important;min-height:50px');
    expect(css).toContain('min-height:56px!important');
    expect(css).toContain('focus-visible');
    expect(css).toContain('max-width:100%');
    expect(css).toContain('@media(max-width:359px)');
  });
  it('keeps commercial/booking operations unchanged',()=>{
    const app=read('driver-pwa-reserve/src/ReserveApp.tsx');
    expect(app).toContain("driverPost('/mobile/bids'");
    expect(app).toContain("driverPost('/mobile/bids/'+encodeURIComponent(job.bidId!)");
    expect(app).toContain('onClick={()=>setView(\'quote\')}');
    expect(css).not.toContain('pointer-events:none');
  });
});
