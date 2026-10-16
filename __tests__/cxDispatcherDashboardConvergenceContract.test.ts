import fs from 'node:fs';
import path from 'node:path';

describe('Dispatcher CX convergence contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'app/components/workspace/DispatcherControlDashboardHome.tsx'),
    'utf8',
  );

  it('uses the canonical execution-company rule instead of job ownership fallback', () => {
    expect(source).toContain('isCompanyExecutionJob(job, data.companyId)');
    expect(source).not.toContain('(job.awarded_carrier_company_id ?? job.company_id) === data.companyId');
  });
  it('keeps two CX-sized primary dispatch signals and moves secondary control lower', () => {
    expect(source).toContain('<OperationalSignalStrip');
    expect(source).not.toContain('<KpiGrid>');
    expect(source).not.toContain('<KpiCard');
    for (const label of ['Unallocated', 'Active']) expect(source).toContain(`label: '${label}'`);
    expect(source).toContain('Resource availability');
    expect(source).toContain('Live exceptions');
    expect(source).toContain('Stale GPS positions');
  });

  it('uses the measured Courier Exchange live dashboard hierarchy for dispatch work', () => {
    expect(source).toContain('<OperationalWorkspaceGrid');
    expect(source).toContain('title="Reports & Statistics"');
    expect(source).toContain('title="Activity at a glance"');
    expect(source).toContain('<OperationalAttentionRail');
    expect(source).toContain('Live exceptions');
    expect(source).toContain('title="Resource availability"');
    expect(source).toContain('title="Reports"');
    expect(source.indexOf('title="Reports & Statistics"')).toBeLessThan(source.indexOf('title="Activity at a glance"'));
    expect(source).not.toContain('<DashboardHomeHeader');
  });

  it('preserves dispatcher-only operational boundaries and verified routes', () => {
    expect(source).not.toContain('/admin/finance');
    expect(source).not.toContain('/admin/marketplace');
    for (const route of ['/admin/fleet/assignments', '/admin/fleet/positions', '/admin/diary', '/admin/incidents']) {
      expect(source).toContain(route);
    }
    const shell = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/TopWorkspaceShell.tsx'), 'utf8');
    const dispatcherNav = shell.slice(shell.indexOf('function composeDispatcherPrimaryNav'), shell.indexOf('function composeFinancePrimaryNav'));
    expect(dispatcherNav).toContain("'/admin/action-centre'");
    expect(dispatcherNav).toContain("'/admin/bulk-import'");
  });

  it('does not fabricate stale GPS counts when tracking data is unavailable', () => {
    expect(source).toContain("value: trackingUnavailable ? '—' : stalePositions.length");
  });
});
