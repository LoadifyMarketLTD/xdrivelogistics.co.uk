import fs from 'node:fs';
import path from 'node:path';

describe('Driver CX convergence contract', () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'app/driver/page.tsx'), 'utf8');
  const parityCss = fs.readFileSync(path.join(process.cwd(), 'app/driver/driver-prototype-parity.css'), 'utf8');
  const layout = fs.readFileSync(path.join(process.cwd(), 'app/driver/layout.tsx'), 'utf8');

  it('keeps current execution and the canonical next action as the primary driver workflow', () => {
    expect(page).toContain('Operational workboard');
    expect(page).toContain('NEXT ACTION');
    expect(page).toContain('NEXT_DRIVER_ACTIONS');
    expect(page).toContain("supabase.rpc('driver_update_job_status_atomic'");
  });

  it('uses the approved prototype hierarchy without the old duplicated desktop rail', () => {
    expect(page).toContain('Today at a glance');
    expect(page).toContain('MATCHING LOADS');
    expect(page).toContain('Commercial position');
    expect(page).toContain('Performance & evidence');
    expect(page).toContain('Driver workflow');
    expect(page).toContain('Latest bookings');
    expect(page).not.toContain('<span>Status & availability</span>');
    expect(page).not.toContain('<span>Canonical active vehicle</span>');
    expect(page).not.toContain('<span>Journey & position</span>');
    expect(parityCss).toContain('.driver-proto-kpis');
    expect(parityCss).toContain('.driver-proto-workboard');
  });

  it('loads the prototype convergence layer in the real Driver workspace', () => {
    expect(layout).toContain("import './driver-prototype-parity.css';");
    expect(parityCss).toContain('--driver-prototype-rail: 245px;');
    expect(parityCss).not.toContain('driver-top-nav');
    expect(parityCss).not.toMatch(/\\.(?:driver-)?fleet/i);
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