import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dashboard = fs.readFileSync(path.join(root, 'app/driver/page.tsx'), 'utf8');
const shellCss = fs.readFileSync(path.join(root, 'app/components/workspace/top-workspace-shell.css'), 'utf8');
const baselineCss = fs.readFileSync(path.join(root, 'app/components/workspace/workspace-measured-cx-baseline.css'), 'utf8');

describe('Courier Exchange live canonical visual reference', () => {
  it('keeps the Driver dashboard composition aligned to the measured CX live structure', () => {
    expect(dashboard).toContain('Reports & Statistics');
    expect(dashboard).toContain('Accounts Payable');
    expect(dashboard).toContain('Feedback in Last 90 Days');
    expect(dashboard).toContain('Activity at a glance');
    expect(dashboard).toContain('Latest Bookings');
    expect(dashboard).toContain('aria-label="Income period"');
    expect(dashboard).toContain('gridTemplateColumns: "minmax(360px, .84fr) minmax(0, 1.16fr)"');
    expect(dashboard).toContain('/api/driver/dashboard/commercial-summary');
    expect(dashboard).not.toContain('Owner Driver business desk');
    expect(dashboard).not.toContain('Invoice readiness');
    expect(dashboard).not.toContain('Return capacity');
  });

  it('preserves the canonical shared CX navbar geometry without a Driver-only shell override', () => {
    expect(shellCss).toContain('.xdrive-operational-top-workspace .top-workspace-nav__item');
    expect(shellCss).not.toContain('CANONICAL DRIVER WORKSPACE SHELL');
    expect(baselineCss).toContain('--ws-nav-h: 42px');
    expect(baselineCss).toContain('--ws-filter-rail-w: 165px');
    expect(baselineCss).toContain('--ws-font-body: 14px');
    expect(baselineCss).toContain('font-family: "HK Nova", Arial, sans-serif');
    expect(shellCss).toContain('height: 42px !important;');
    expect(shellCss).toContain('padding: 0 13px !important;');
    expect(shellCss).toContain('font-size: 13px !important;');
    expect(shellCss).toContain('font-weight: 600 !important;');
    expect(shellCss).toContain('box-shadow: inset 0 -2px 0 #1d57d8 !important;');
  });

  it('keeps all operational workspaces on the same measured Courier Exchange live baseline without role-specific visual drift', () => {
    expect(baselineCss).toContain('.xdrive-workspace-measured .xdrive-dashboard-home-header');
    expect(baselineCss).toContain('.xdrive-workspace-measured .xdrive-operational-card__header');
    expect(baselineCss).toContain('min-height: var(--ws-panel-head-h) !important');
    expect(baselineCss).toContain('--ws-filter-rail-w: 165px');
    expect(fs.existsSync(path.join(root, 'app/components/workspace/non-driver-owner-reference.css'))).toBe(false);
  });
});
