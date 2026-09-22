import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('live Driver workspace visual parity contract', () => {
  it('keeps the Driver information architecture unchanged', () => {
    const shell = read('app/driver/_components/DriverTopWorkspaceShell.tsx');
    for (const label of ['Dashboard', 'Directory', 'Return Journeys', 'Loads', 'Quotes', 'Diary', 'Event Log']) {
      expect(shell).toContain(`label: '${label}'`);
    }
    expect(shell).toContain("summary className=\"driver-top-nav__item driver-top-nav__more-trigger\"");
    expect(shell).toContain('Action Centre');
    expect(shell).toContain('Sign out');
  });

  it('matches the Company workspace readable header scale', () => {
    const css = read('app/driver/driver-live-parity.css');
    expect(css).toContain('height: 62px !important;');
    expect(css).toContain('font-size: 14px !important;');
    expect(css).toContain('font-weight: 650 !important;');
    expect(css).toContain('box-shadow: inset 0 -3px 0 #1d57d8 !important;');
    expect(css).toContain('height: 36px !important;');
    expect(css).toContain('font-weight: 700 !important;');
  });

  it('loads the parity layer after the measured baseline', () => {
    const layout = read('app/driver/layout.tsx');
    const baseline = layout.indexOf("workspace-measured-cx-baseline.css");
    const parity = layout.indexOf("driver-live-parity.css");
    expect(baseline).toBeGreaterThan(-1);
    expect(parity).toBeGreaterThan(baseline);
  });

  it('removes the duplicate dashboard role eyebrow while keeping it elsewhere', () => {
    const shell = read('app/driver/_components/DriverWorkspaceShell.tsx');
    expect(shell).toContain("eyebrow={pathname === '/driver' ? undefined : (personaLabel ?? 'Driver workspace')}");
  });

  it('raises dashboard operational copy to the readable scale', () => {
    const css = read('app/driver/driver-live-parity.css');
    expect(css).toContain('.driver-reference-dashboard .driver-cell-label');
    expect(css).toContain('.driver-reference-dashboard .driver-cell-primary');
    expect(css).toContain('.driver-reference-dashboard .driver-cell-secondary');
    expect(css).toContain('font-size: 12px !important;');
    expect(css).toContain('font-size: 14px !important;');
  });
});