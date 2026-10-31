import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const page=readFileSync('app/driver-pwa-fresh/visual-preview/workflow/page-0/page.tsx','utf8');

describe('driver workflow preview page zero',()=>{
  it('renders the approved acceptance screen before page one',()=>{
    expect(page).toContain('title="Accept Job"');
    expect(page).toContain('Acceptance Required');
    expect(page).toContain('BLACKBURN, BB1');
    expect(page).toContain('MANCHESTER, M2');
    expect(page).not.toContain('SmartPay');
  });
  it('links all four required actions',()=>{
    expect(page).toContain('/driver-pwa-fresh/visual-preview/map?load=visual-1');
    expect(page).toContain("details?'Hide Details':'View Details'");
    expect(page).toContain('/driver-pwa-fresh/visual-preview/workflow?tab=bookings');
    expect(page).toContain('/driver-pwa-fresh/visual-preview/workflow/page-1');
  });
});
