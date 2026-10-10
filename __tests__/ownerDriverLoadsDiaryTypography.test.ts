import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const loadsPage = readFileSync('app/driver/loads/page.tsx', 'utf8');
const loadsCss = readFileSync('app/driver/driver-full-prototype.css', 'utf8');
const diaryCss = readFileSync('app/driver/history/diary-exchange.css', 'utf8');

describe('Loads and Diary CX-inspired typography hierarchy', () => {
  it('separates town and postcode in Loads', () => {
    expect(loadsPage).toContain('splitTownPostcode');
    expect(loadsPage).toContain('className="load-town"');
    expect(loadsPage).toContain('className="load-postcode"');
  });

  it('uses the approved Loads type scale', () => {
    expect(loadsCss).toContain('PR675 Loads typography: CX-inspired weight hierarchy');
    expect(loadsCss).toContain('font-size:12.5px!important;font-weight:700!important');
    expect(loadsCss).toContain('font-size:12px!important;font-weight:450!important');
    expect(loadsCss).toContain('font-size:10.5px!important;line-height:14px!important;font-weight:500!important');
    expect(loadsCss).toContain('font-size:11px!important;line-height:15px!important;font-weight:450!important');
  });

  it('uses matching Diary hierarchy without 800-weight card typography', () => {
    expect(diaryCss).toContain('PR675 Diary typography: match Loads/CX hierarchy');
    expect(diaryCss).toContain('.driver-diary-entry .driver-cell-primary{font-size:12px!important;line-height:16px!important;font-weight:600!important');
    expect(diaryCss).toContain('.driver-diary-status-band{font-size:12px!important;font-weight:650!important');
    expect(diaryCss).toContain('.driver-diary-operational-timeline strong{font-size:11px!important;font-weight:600!important');
  });
});