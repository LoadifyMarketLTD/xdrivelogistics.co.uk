import fs from 'node:fs';
import path from 'node:path';

describe('Carrier CX convergence contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'app/components/workspace/CarrierOperationsDashboardHome.tsx'),
    'utf8',
  );
  const visualCss = fs.readFileSync(
    path.join(process.cwd(), 'app/components/workspace/CarrierDashboard.module.css'),
    'utf8',
  );

  it('keeps the approved 56px six-signal control strip rather than a large KPI wall', () => {
    expect(source).toContain('<CarrierControlSignals signals={signals} />');
    expect(source).toContain('className={carrierStyles.signals}');
    expect(visualCss).toContain('grid-template-columns: repeat(6, minmax(0, 1fr));');
    expect(visualCss).toMatch(/\.signals\s*\{[\s\S]*?height:\s*56px;/);
    expect(visualCss).toMatch(/\.signal\s*\{[\s\S]*?height:\s*56px;/);
    expect(source).not.toContain('<KpiGrid>');
    expect(source).not.toContain('<KpiCard');
  });

  it('keeps carrier-awarded work as the primary workboard after controls', () => {
    expect(source).toContain('Carrier Control Desk');
    expect(source).toContain('Operational workboard');
    expect(source).toContain('carrier-awarded work only');
    expect(source.indexOf('Operational workboard')).toBeLessThan(source.indexOf('Commercial position'));
    expect(source.indexOf('Operational workboard')).toBeLessThan(source.indexOf('Activity at a glance'));
    expect(source.indexOf('Operational workboard')).toBeLessThan(source.indexOf('Carrier workflow'));
  });

  it('preserves dense operational filters and carrier execution boundaries', () => {
    expect(source).toContain('<OperationalFilters');
    expect(source).toContain("job.awarded_carrier_company_id === data.companyId");
    expect(source).toContain("columns={['Ref', 'Priority', 'Route', 'Pickup', 'Required vehicle', 'Driver', 'Status', 'Action']}");
  });

  it('retains carrier workflow routes without changing lifecycle authority', () => {
    for (const route of [
      '/admin/marketplace',
      '/admin/fleet/assignments',
      '/admin/fleet/active-jobs',
      '/admin/fleet/positions',
      '/admin/diary',
      '/admin/jobs',
    ]) {
      expect(source).toContain(route);
    }
  });
});
