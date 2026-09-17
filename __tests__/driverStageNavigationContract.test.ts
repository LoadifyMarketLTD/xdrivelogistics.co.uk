import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../app/components/workspace/DriverJobExecutionPage.tsx', import.meta.url), 'utf8');

describe('driver stage navigation contract', () => {
  it('offers Google Maps and Waze while travelling to pickup or delivery', () => {
    expect(source).toContain("currentStatus === 'on_my_way' ? 'pickup'");
    expect(source).toContain("currentStatus === 'in_transit' ? 'delivery'");
    expect(source).toContain('https://www.google.com/maps/dir/?api=1&destination=');
    expect(source).toContain('https://www.waze.com/ul?q=');
    expect(source).toContain('Google Maps ? {navigationStage');
    expect(source).toContain('Waze ? {navigationStage');
  });
});
