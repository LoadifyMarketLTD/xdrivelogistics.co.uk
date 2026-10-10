import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('app/driver/history/page.tsx','utf8');
const api = readFileSync('app/api/driver/diary/company-snapshot/route.ts','utf8');
const css = readFileSync('app/driver/history/diary-exchange.css','utf8');

describe('Diary collapsed CX information density',()=>{
  it('loads commercial quick facts for personal and company diary rows',()=>{
    for (const field of ['job_distance_miles','agreed_rate_gbp','agreed_rate','currency','payment_terms']) {
      expect(page).toContain(field);
      expect(api).toContain(field);
    }
  });
  it('renders the collapsed quick-facts strip',()=>{
    expect(page).toContain('driver-diary-collapsed-facts');
    for (const label of ['Booked by','Agreed rate','Distance','Weight','Packaging','Requested','Payment terms','POD']) expect(page).toContain(label);
  });
  it('keeps details optional and the collapsed strip compact',()=>{
    expect(css).toContain('PR675 Diary collapsed quick facts');
    expect(css).toContain('min-height:48px!important');
    expect(css).toContain('font-size:10.5px!important');
    expect(css).toContain('font-size:11px!important');
  });
});