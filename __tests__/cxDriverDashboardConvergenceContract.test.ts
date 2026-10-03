import fs from 'node:fs';
import path from 'node:path';

describe('Driver canonical dashboard convergence contract', () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'app/driver/page.tsx'), 'utf8');
  const parityCss = fs.readFileSync(path.join(process.cwd(), 'app/driver/driver-prototype-parity.css'), 'utf8');
  const exactCss = fs.readFileSync(path.join(process.cwd(), 'app/driver/driver-dashboard-prototype-exact.css'), 'utf8');
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

  it('keeps the approved driver CSS layers loaded', () => {
    expect(layout).toContain("import './driver-prototype-parity.css';");
    expect(layout).toContain("import './driver-dashboard-prototype-exact.css';");
    expect(exactCss).toContain('Exact Dashboard V2 visual layer copied from the prototype served on 127.0.0.1:17883');
    expect(parityCss).not.toContain('driver-top-nav');
  });
  it('does not rewrite lifecycle authority or move desktop density into Expo mobile', () => {
    expect(page).toContain('p_next_status: nextStatus');
    expect(parityCss).toContain('@media (max-width: 768px)');
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
