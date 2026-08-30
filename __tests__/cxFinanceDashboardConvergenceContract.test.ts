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

  it('puts Ready to Invoice before receivables, exposure and settled history', () => {
    expect(source).toContain('<OperationalWorkspaceGrid');
    expect(source.indexOf('Ready to Invoice')).toBeLessThan(source.indexOf('Receivables requiring attention'));
    expect(source.indexOf('Receivables requiring attention')).toBeLessThan(source.indexOf('Recently settled'));
    expect(source.indexOf('Receivables requiring attention')).toBeLessThan(source.indexOf('Financial exposure'));
  });

  it('derives invoice readiness from completed work operated by the current company', () => {
    expect(source).toContain("classifyWorkspaceJobStage(job) === 'completed'");
    expect(source).toContain('job.awarded_carrier_company_id === data.companyId');
    expect(source).toContain('!job.awarded_carrier_company_id && job.company_id === data.companyId');
    expect(source).toContain('!issuedInvoiceJobIds.has(job.id)');
    expect(source).toContain('invoice.supplier_company_id === data.companyId');
    expect(source).toContain('invoice.company_id === data.companyId');
    expect(source).toContain('invoice.buyer_company_id !== data.companyId');
    expect(source).toContain('Completed transport operated by this company with no supplier-side invoice linked to the job');
    expect(source).toContain('This is a derived finance queue, not a new job lifecycle status.');
    expect(source).toContain('Create invoice');
    expect(source).toContain('/admin/invoices/new?');
    expect(source).not.toContain("status: 'ready_to_invoice'");
  });

  it('keeps invoice availability truthful and finance-only routes intact', () => {
    expect(source).toContain("const invoicesUnavailable = unavailable(data, ['invoices']);");
    expect(source).toContain("const readyToInvoiceUnavailable = unavailable(data, ['jobs', 'invoices']);");
    expect(source).toContain("empty={<EmptyState compact title={invoicesUnavailable ? 'Invoice data unavailable' : 'No outstanding receivables'} />}");
    for (const route of ['/admin/invoices', '/admin/finance/balances', '/admin/finance/payments', '/admin/finance/reports']) {
      expect(source).toContain(route);
    }
  });
});
