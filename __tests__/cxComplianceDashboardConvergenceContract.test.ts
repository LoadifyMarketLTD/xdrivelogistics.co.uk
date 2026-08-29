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

  it('puts verification and expiry work before coverage analytics', () => {
    expect(source).toContain('<OperationalWorkspaceGrid');
    expect(source.indexOf('Priority verification & expiry queue')).toBeLessThan(source.indexOf('Compliance coverage'));
    expect(source.indexOf('Priority verification & expiry queue')).toBeLessThan(source.indexOf('Incidents requiring follow-up'));
  });

  it('preserves truthful unavailable states and canonical eligibility language', () => {
    expect(source).toContain("const documentsUnavailable = unavailable(data, ['driverDocuments', 'vehicleDocuments']);");
    expect(source).toContain("const incidentsUnavailable = unavailable(data, ['jobs']);");
    expect(source).toContain('Full operational eligibility remains enforced by the canonical server contract.');
  });
});
