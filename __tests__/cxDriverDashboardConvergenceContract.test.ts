import fs from 'node:fs';
import path from 'node:path';

describe('Driver CX convergence contract', () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'app/driver/page.tsx'), 'utf8');
  const parityCss = fs.readFileSync(path.join(process.cwd(), 'app/driver/driver-prototype-parity.css'), 'utf8');
  const exactCss = fs.readFileSync(path.join(process.cwd(), 'app/driver/driver-dashboard-prototype-exact.css'), 'utf8');
  const layout = fs.readFileSync(path.join(process.cwd(), 'app/driver/layout.tsx'), 'utf8');

  it('keeps current execution and the canonical next action as the primary driver workflow', () => {
    expect(page).toContain('Operational workboard');
    expect(page).toContain('NEXT ACTION');
    expect(page).toContain('NEXT_DRIVER_ACTIONS');
    expect(page).toContain("supabase.rpc('driver_update_job_status_atomic'");
  });

  it('uses the exact served prototype hierarchy without the old duplicated desktop rail', () => {
    for (const marker of ['Today at a glance', 'Matching Loads', 'Commercial position', 'Performance & evidence', 'Driver workflow', 'Latest bookings']) {
      expect(page).toContain(marker);
    }
    expect(page).not.toContain('<span>Status & availability</span>');
    expect(page).not.toContain('<span>Canonical active vehicle</span>');
    expect(page).not.toContain('<span>Journey & position</span>');
    expect(exactCss).toContain('.xd2-hero');
    expect(exactCss).toContain('.xd2-kpis');
    expect(page).toContain('xd2-workboard');
    expect(exactCss).toContain('.xd2-primary-grid');
    expect(exactCss).toContain('.xd2-secondary-grid');
  });

  it('loads the literal prototype CSS after the existing Driver convergence layer', () => {
    expect(layout).toContain("import './driver-prototype-parity.css';");
    expect(layout).toContain("import './driver-dashboard-prototype-exact.css';");
    expect(exactCss).toContain('Exact Dashboard V2 visual layer copied from the prototype served on 127.0.0.1:17883');
    expect(parityCss).not.toContain('driver-top-nav');
  });

  it('does not rewrite lifecycle authority or move desktop density into Expo mobile', () => {
    expect(page).toContain('nextDriverExecutionStatus(currentStatus)');
    expect(page).toContain('p_next_status: nextStatus');
    expect(parityCss).toContain('@media (max-width: 768px)');
    expect(page).not.toContain('apps/driver-mobile');
  });

  it('preserves truthful server-authoritative eligibility wording', () => {
    expect(page).toContain('Full quote eligibility remains server-authoritative.');
    expect(page).toContain('data.driverDocuments');
    expect(page).toContain("fetch('/api/driver/vehicles'");
  });
});
