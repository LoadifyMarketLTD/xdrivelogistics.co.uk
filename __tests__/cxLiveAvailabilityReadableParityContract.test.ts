import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('CX Live Availability readable parity', () => {
  const typography = read('app/components/workspace/workspace-readable-typography.css');
  const admin = read('app/admin/live-availability/page.tsx');
  const driver = read('app/driver/availability/live/DriverAvailabilityLiveWorkspace.tsx');
  const driverCss = read('app/driver/driver-live-availability.css');

  it('uses the approved Diary-readable global operational type scale', () => {
    for (const token of [
      '--ws-font-section-title: 16px;',
      '--ws-font-panel-title: 16px;',
      '--ws-font-body: 14px;',
      '--ws-font-label: 14px;',
      '--ws-font-meta: 14px;',
      '--ws-font-micro: 14px;',
    ]) expect(typography).toContain(token);
  });

  it('adds an explicit Live Availability scope for generic legacy wrappers', () => {
    expect(admin).toContain('xdrive-live-availability-page');
    expect(driver).toContain('driver-live-availability-canonical');
    expect(driver).toContain('<DriverWorkspaceShell hideHeader>');
    expect(typography).toContain(':is(.xdrive-live-availability-page, .driver-live-availability-canonical, .xdrive-my-fleet-canonical) *');
    expect(typography).toContain('font-size: 14px !important;');
  });

  it('uses the same global geometry in Driver and company Live Availability', () => {
    expect(driverCss).toContain('grid-template-columns:var(--ws-filter-rail-w,196px) minmax(0,1fr);');
    expect(driverCss).toContain('gap:var(--ws-gap-grid,14px);');
    expect(driverCss).toContain('width:calc(100% + (2 * var(--ws-page-x,16px)));');
    expect(driverCss).toContain('min-height: var(--ws-panel-head-h, 40px);');
    expect(driverCss).not.toContain('gap:10px;');
  });

  it('preserves the current CX live controls without the removed dashboard clutter', () => {
    for (const label of ['All</button>', 'Drivers &amp; Sub-contractors</button>', 'Other Drivers', 'Add Future Position', 'Search Panel', 'Register your vehicles', 'Quick Search']) expect(admin).toContain(label);
    for (const label of ['All</button>', 'Drivers & Sub-contractors</button>', 'Other Drivers</button>']) expect(driver).toContain(label);
    expect(admin).not.toContain('OperationalSignalStrip');
    expect(admin).not.toContain('Availability conflicts');
  });
});
