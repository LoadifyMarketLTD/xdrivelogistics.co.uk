import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('app/driver/quotes/page.tsx','utf8');
const css = readFileSync('app/driver/driver-full-prototype.css','utf8');

describe('Owner Driver Quotes visual parity with Loads and Diary',()=>{
  it('retains XDrive quote lifecycle functions and tabs',()=>{
    for(const label of ['Received','Shortlisted','Submitted','Accepted / Won','Unsuccessful','Withdrawn','Expired','Archived']) expect(page).toContain(label);
    for(const action of ['View Quote','Shortlist','Withdraw','Archive','Restore']) expect(page).toContain(action);
  });
  it('uses the shared three-column card grammar',()=>{
    expect(css).toContain('PR675 Quotes: align visual grammar with Loads / Diary / CX');
    expect(css).toContain('grid-template-columns:minmax(0,1.12fr) minmax(0,1fr) minmax(300px,.98fr)!important');
    expect(css).toContain('min-height:82px!important');
  });
  it('uses the approved typography hierarchy',()=>{
    expect(css).toContain('font-size:10.8px!important');
    expect(css).toContain('font-size:12px!important');
    expect(css).toContain('font-weight:600!important');
    expect(css).toContain('font-weight:450!important');
    expect(css).toContain('font-size:10px!important');
  });
  it('keeps status, metadata and footer compact',()=>{
    expect(css).toContain('font-weight:650!important');
    expect(css).toContain('height:30px!important');
    expect(css).toContain('font-size:10.5px!important');
  });
});