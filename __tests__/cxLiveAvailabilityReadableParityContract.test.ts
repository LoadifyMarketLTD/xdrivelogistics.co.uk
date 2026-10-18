import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('CX Live Availability readable parity', () => {
  const typography = read('app/components/workspace/workspace-readable-typography.css');
  const admin = read('app/admin/live-availability/page.tsx');
  const driver = read('app/driver/availability/live/DriverAvailabilityLiveWorkspace.tsx');

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
    expect(typography).toContain(':is(.xdrive-live-availability-page, .driver-live-availability-canonical) *');
    expect(typography).toContain('font-size: 14px !important;');
  });

  it('preserves the CX live audience controls and actions', () => {
    for (const label of ['All</button>', 'Drivers &amp; Sub-contractors</button>', 'Other Drivers']) expect(admin).toContain(label);
    for (const label of ['All</button>', 'Drivers & Sub-contractors</button>', 'Other Drivers</button>']) expect(driver).toContain(label);
    expect(admin).toContain('Find Nearest');
    expect(admin).toContain('Book Direct');
    expect(driver).toContain('Find Nearest');
  });
});
