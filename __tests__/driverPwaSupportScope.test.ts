import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Driver PWA More support scope', () => {
  it('keeps support inside the installed PWA scope', () => {
    const more = source('app/m/driver/more/page.tsx');
    const nav = source('app/m/driver/DriverMobileNavigation.tsx');
    expect(more).toContain("href: '/m/driver/support'");
    expect(more).not.toContain("href: '/driver/support'");
    expect(nav).toContain("'/m/driver/support'");
    expect(nav).toContain("'/m/driver/finance'");
  });

  it('uses XDrive contact configuration and supplies booking-specific support guidance', () => {
    const support = source('app/m/driver/support/page.tsx');
    expect(support).toContain('COMPANY_CONFIG.email');
    expect(support).toContain('COMPANY_CONFIG.phone');
    expect(support).toContain('Driver PWA support');
    expect(support).toContain('job reference');
    expect(support).toContain('/m/driver/documents');
    expect(support).toContain('/m/driver/more');
    expect(support).not.toContain('process.env.');
  });
});
