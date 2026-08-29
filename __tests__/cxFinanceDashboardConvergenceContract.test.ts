import fs from 'node:fs';
import path from 'node:path';

describe('Finance CX convergence contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'app/components/workspace/FinanceControlDashboardHome.tsx'),
    'utf8',
  );

  it('uses a compact finance signal strip instead of a KPI wall', () => {
    expect(source).toContain('<OperationalSignalStrip');
    expect(source).not.toContain('<KpiGrid>');
    expect(source).not.toContain('<KpiCard');
  });

  it('places receivables before exposure, actions and settled history', () => {
    expect(source).toContain('<OperationalWorkspaceGrid');
    expect(source.indexOf('Receivables requiring attention')).toBeLessThan(source.indexOf('Recently settled'));
    expect(source.indexOf('Receivables requiring attention')).toBeLessThan(source.indexOf('Financial exposure'));
  });

  it('keeps invoice availability truthful and finance-only routes intact', () => {
    expect(source).toContain("const invoicesUnavailable = unavailable(data, ['invoices']);");
    expect(source).toContain("empty={<EmptyState compact title={invoicesUnavailable ? 'Invoice data unavailable' : 'No outstanding receivables'} />}");
    for (const route of ['/admin/invoices', '/admin/finance/balances', '/admin/finance/payments', '/admin/finance/reports']) {
      expect(source).toContain(route);
    }
  });
});
