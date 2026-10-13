import fs from 'node:fs';
import path from 'node:path';

describe('Driver canonical dashboard convergence contract', () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'app/driver/page.tsx'), 'utf8');
  const parityCss = fs.readFileSync(path.join(process.cwd(), 'app/driver/driver-prototype-parity.css'), 'utf8');
  const measuredCss = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/workspace-measured-cx-baseline.css'), 'utf8');
  const layout = fs.readFileSync(path.join(process.cwd(), 'app/driver/layout.tsx'), 'utf8');

  it('keeps current execution and the canonical next action as the primary driver workflow', () => {
    expect(page).toContain('Current assignment');
    expect(page).toContain('NEXT ACTION');
    expect(page).toContain('nextDriverExecutionStatus(currentStatus)');
    expect(page).toContain("supabase.rpc('driver_update_job_status_atomic'");
  });

  it('uses the current operational hierarchy for driver execution', () => {
    for (const marker of ['Current assignment', 'Next booking', 'Driver readiness', 'Assigned work']) {
      expect(page).toContain(marker);
    }
    expect(page).toContain('driver-dashboard-register');
    expect(page).toContain('driver-dashboard-statusbar');
  });

  it('keeps the frozen PR675 dashboard layers loaded after the shared Driver convergence layers', () => {
    expect(layout).toContain("import './driver-prototype-parity.css';");
    expect(layout).toContain("import './driver-dashboard-reference.css';");
    expect(layout).toContain("import './driver-dashboard-cx-close.css';");
    expect(layout).toContain("import './driver-dashboard-prototype-exact.css';");
    expect(page).toContain('driver-exact-prototype');
    expect(parityCss).not.toContain('driver-top-nav');
  });
  it('does not rewrite lifecycle authority or move desktop density into Expo mobile', () => {
    expect(page).toContain('p_next_status: nextStatus');
    // Shared measured CSS owns mobile operational records; a generic Driver
    // parity media override would compete with the canonical 52px rows.
    expect(measuredCss).toContain('@media (max-width: 768px)');
    expect(measuredCss).toContain('.xdrive-workspace-measured .driver-load-row__top,');
    expect(measuredCss).toContain('grid-template-columns: 1fr !important;');
    expect(parityCss).not.toMatch(/@media \(max-width: 768px\)\s*\{\s*\.xdrive-driver-workspace \.driver-load-row__top/);
    expect(page).not.toContain('apps/driver-mobile');
  });

  it('keeps role separation and degraded data truthful', () => {
    expect(page).toContain("const ownerDriver = workspaceRole === 'owner_driver'");
    expect(page).toContain('Reports & Statistics');
    expect(page).toContain('Accounts Payable');
    expect(page).toContain('/api/driver/dashboard/commercial-summary');
    expect(page).toContain('Assignment data unavailable');
    expect(page).toContain('Assignment data is partial');
    expect(page).toContain("fetch('/api/driver/vehicles'");
  });
});
