import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dashboard = fs.readFileSync(path.join(root, 'app/driver/page.tsx'), 'utf8');
const shellCss = fs.readFileSync(path.join(root, 'app/components/workspace/top-workspace-shell.css'), 'utf8');
const ownerAdapter = fs.readFileSync(path.join(root, 'app/components/workspace/non-driver-owner-reference.css'), 'utf8');

describe('Owner Driver canonical visual reference', () => {
  it('preserves the approved Owner Driver dashboard composition', () => {
    expect(dashboard).toContain('Reports & Statistics');
    expect(dashboard).toContain('Accounts Payable');
    expect(dashboard).toContain('Feedback in Last 90 Days');
    expect(dashboard).toContain('Activity at a glance');
    expect(dashboard).toContain('Latest assigned bookings');
    expect(dashboard).toContain('Freight Messenger');
    expect(dashboard).toContain('Reports period');
    expect(dashboard).toContain('/api/driver/dashboard/commercial-summary');
    expect(dashboard).not.toContain('Owner Driver business desk');
    expect(dashboard).not.toContain('Invoice readiness');
    expect(dashboard).not.toContain('Return capacity');
  });

  it('preserves the canonical desktop Driver shell geometry', () => {
    expect(shellCss).toContain('CANONICAL DRIVER WORKSPACE SHELL');
    expect(shellCss).toContain('.xdrive-driver-workspace .top-workspace-shell__header');
    expect(shellCss).toContain('height: 50px !important;');
    expect(shellCss).toContain('gap: 10px !important;');
    expect(shellCss).toContain('padding: 0 18px !important;');
    expect(shellCss).toContain('font-size: 14px !important;');
    expect(shellCss).toContain('min-height: calc(100vh - 100px) !important;');
  });

  it('keeps non-driver operational workspaces attached to the saved Owner reference adapter', () => {
    expect(ownerAdapter).toContain('Owner Driver visual-reference adapter for non-driver operational workspaces only');
    expect(ownerAdapter).toContain('--owner-ref-control: 32px;');
    expect(ownerAdapter).toContain('--owner-ref-radius: 4px;');
    expect(ownerAdapter).toContain('.xdrive-owner-reference-workspace .xdrive-dashboard-home-header');
  });
});
