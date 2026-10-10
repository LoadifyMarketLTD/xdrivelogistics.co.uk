import fs from 'node:fs';
import path from 'node:path';

describe('Carrier CX convergence contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'app/components/workspace/CarrierOperationsDashboardHome.tsx'),
    'utf8',
  );

  it('keeps compact control signals rather than a large KPI wall', () => {
    expect(source).toContain('<CarrierControlSignals signals={signals} />');
    expect(source).toContain("minHeight: '54px'");
    expect(source).not.toContain('<KpiGrid>');
    expect(source).not.toContain('<KpiCard');
  });

  it('keeps carrier-awarded work visible alongside the converged Owner/Fleet control cards', () => {
    expect(source).toContain('Reports & Statistics');
    expect(source).toContain('Commercial & Finance');
    expect(source).toContain('Activity at a glance');
    expect(source).toContain('Carrier workflow');
    expect(source).toContain('Operational workboard');
    expect(source).toContain('carrier-awarded work only');
  });

  it('preserves dense operational filters and carrier execution boundaries', () => {
    expect(source).toContain('<OperationalFilters');
    expect(source).toContain('isCompanyExecutionJob(job, data.companyId)');
    expect(source).toContain("columns={['Ref', 'Priority', 'Route', 'Pickup', 'Required vehicle', 'Driver', 'Status', 'Action']}");
  });

  it('retains carrier workflow routes without changing lifecycle authority', () => {
    for (const route of [
      '/admin/marketplace',
      '/admin/fleet/assignments',
      '/admin/fleet/active-jobs',
      '/admin/live-availability',
      '/admin/diary',
      '/admin/jobs',
    ]) {
      expect(source).toContain(route);
    }
  });
});
