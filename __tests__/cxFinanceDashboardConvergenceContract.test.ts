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

  it('uses the canonical Owner Driver dashboard hierarchy and preserves finance activity ordering', () => {
    expect(source).toContain('<OperationalWorkspaceGrid');
    expect(source).toContain('title="Reports & Statistics"');
    expect(source).toContain('title="Activity at a glance"');
    expect(source).toContain('title="Financial exposure"');
    expect(source).toContain('title="Reports"');
    expect(source.indexOf('title="Reports & Statistics"')).toBeLessThan(source.indexOf('title="Activity at a glance"'));
    expect(source.indexOf('title="Activity at a glance"')).toBeLessThan(source.indexOf('Receivables requiring attention'));
    expect(source.indexOf('Receivables requiring attention')).toBeLessThan(source.indexOf('Recently settled'));
    expect(source).not.toContain('<DashboardHomeHeader');
  });

  it('derives invoice readiness from completed work operated by the current company', () => {
    expect(source).toContain("classifyWorkspaceJobStage(job) === 'completed'");
    expect(source).toContain('isCompanyExecutionJob(job, data.companyId)');
    expect(source).toContain('!job.awarded_carrier_company_id && !job.assigned_company_id && job.company_id === data.companyId');
    expect(source).toContain('!issuedInvoiceJobIds.has(job.id)');
    expect(source).toContain('invoice.supplier_company_id === data.companyId');
    expect(source).toContain('invoice.company_id === data.companyId');
    expect(source).toContain('invoice.buyer_company_id !== data.companyId');
    expect(source).toContain('Completed transport operated by this company that is ready for an invoice.');
    expect(source).not.toContain('derived finance queue');
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
