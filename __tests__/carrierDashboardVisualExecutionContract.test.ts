import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => readFileSync(join(process.cwd(), relative), 'utf8');

describe('Carrier dashboard visual execution contract', () => {
  const page = read('app/components/workspace/CarrierOperationsDashboardHome.tsx');
  const css = read('app/components/workspace/CarrierDashboard.module.css');
  const shellCss = read('app/components/workspace/top-workspace-shell.css');

  it('uses the Carrier execution primitives instead of legacy dashboard geometry', () => {
    expect(page).toContain('className={carrierStyles.page}');
    expect(page).toContain('className={carrierStyles.header}');
    expect(page).toContain('className={carrierStyles.workboard}');
    expect(page).toContain('className={carrierStyles.lowerGrid}');
    expect(page).not.toContain('<DashboardHomeHeader');
    expect(page).not.toContain('<OperationalCard');
    expect(page).not.toContain('<EmptyState');
  });

  it('keeps exactly the six approved Carrier control signals', () => {
    for (const label of [
      'Needs attention',
      'Awaiting allocation',
      'Live jobs',
      'Photo evidence',
      'Available drivers',
      'Exceptions',
    ]) {
      expect(page).toContain(`label: '${label}'`);
    }
    const signalEntries = page.match(/\{ key: '(?:attention|unallocated|live|pod|drivers|exceptions)'/g) ?? [];
    expect(signalEntries).toHaveLength(6);
  });

  it('keeps the approved contextual toolbar and does not restore a header action', () => {
    for (const label of [
      'Jobs',
      'Live Availability',
      'Live Positions',
      'Freight Vision',
      'Directory',
      'Messages',
      'Event Log',
    ]) {
      expect(page).toContain(`>${label}</ActionButton>`);
    }
    expect(page).toContain("{data.loading ? 'Refreshing…' : 'Refresh'}");
    expect(page).not.toContain('actions={<ActionButton');
  });
  it('locks the exact desktop geometry from the approved blueprint', () => {
    expect(css).toMatch(/\.page\s*\{[\s\S]*?padding:\s*12px 12px 16px;/);
    expect(css).toMatch(/\.header\s*\{[\s\S]*?height:\s*78px;/);
    expect(css).toMatch(/\.signals\s*\{[\s\S]*?height:\s*56px;/);
    expect(css).toMatch(/\.workboardHeader\s*\{[\s\S]*?height:\s*40px;/);
    expect(css).toMatch(/\.tabs\s*\{[\s\S]*?height:\s*32px;/);
    expect(css).toMatch(/\.workboardFooter\s*\{[\s\S]*?height:\s*32px;/);
    expect(css).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, 1.35fr);');
    expect(css).toMatch(/\.panelHeader\s*\{[\s\S]*?height:\s*44px;/);
    expect(css).toMatch(/\.compactEmpty\s*\{[\s\S]*?height:\s*64px;/);
  });

  it('locks Carrier shell overrides to the current 90px shell contract', () => {
    expect(shellCss).toContain('height: 56px !important;');
    expect(shellCss).toContain('top: 102px !important;');
    expect(shellCss).toContain('height: 36px !important;');
    expect(shellCss).toContain('height: 44px !important;');
    expect(shellCss).not.toContain('Carrier dashboard control signals follow the measured 72px KPI target');
  });
});
