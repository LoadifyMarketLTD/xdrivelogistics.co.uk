import fs from 'node:fs';
import path from 'node:path';

describe('Compliance CX convergence contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'app/components/workspace/ComplianceControlDashboardHome.tsx'),
    'utf8',
  );

  it('uses compact compliance signals instead of a KPI wall', () => {
    expect(source).toContain('<OperationalSignalStrip');
    expect(source).not.toContain('<KpiGrid>');
    expect(source).not.toContain('<KpiCard');
  });

  it('uses the canonical Owner Driver dashboard hierarchy while keeping compliance work role-specific', () => {
    expect(source).toContain('<OperationalWorkspaceGrid');
    expect(source).toContain('title="Reports & Statistics"');
    expect(source).toContain('title="Activity at a glance"');
    expect(source).toContain('title="Compliance coverage"');
    expect(source).toContain('title="Reports"');
    expect(source).toContain('Priority verification and expiry work.');
    expect(source.indexOf('title="Reports & Statistics"')).toBeLessThan(source.indexOf('title="Activity at a glance"'));
    expect(source.indexOf('title="Activity at a glance"')).toBeLessThan(source.indexOf('Incidents requiring follow-up'));
    expect(source).not.toContain('<DashboardHomeHeader');
  });

  it('renders compliance document statuses through the shared visual badge instead of removed inline status colours', () => {
    const documentsPage = fs.readFileSync(path.join(process.cwd(), 'app/admin/documents/page.tsx'), 'utf8');
    expect(documentsPage).toContain('<StatusBadge value={item.status} tone={documentStatusTone} />');
    expect(documentsPage).toContain("item.status === 'approved' ? 'green'");
    expect(documentsPage).toContain("item.status === 'pending' ? 'orange' : 'red'");
    expect(documentsPage).not.toContain('STATUS_COLORS');
  });

  it('preserves truthful unavailable states without exposing backend eligibility language', () => {
    expect(source).toContain("const documentsUnavailable = unavailable(data, ['driverDocuments', 'vehicleDocuments']);");
    expect(source).toContain("const incidentsUnavailable = unavailable(data, ['jobs']);");
    expect(source).toContain('Verification, expiry and compliance position.');
    expect(source).not.toContain('canonical server contract');
  });
});
