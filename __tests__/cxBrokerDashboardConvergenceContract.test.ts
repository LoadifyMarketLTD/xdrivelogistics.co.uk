import fs from 'node:fs';
import path from 'node:path';

describe('Broker approved prototype convergence contract', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'app/broker/BrokerDashboardHome.tsx'), 'utf8');

  it('uses the dedicated six-signal Broker commercial desk', () => {
    for (const label of ['Open Loads','Quotes Received','Awaiting Award','Active Jobs','POD Missing','Gross Margin']) {
      expect(source).toContain(`label="${label}"`);
    }
    expect(source).toContain('<ExchangeKpiStrip>');
    expect(source).toContain('Quote decisions requiring action');
    expect(source).toContain('Live carrier execution');
    expect(source).toContain('Commercial exposure');
  });

  it('preserves the approved Broker action queue and decision workflow', () => {
    expect(source).toContain('title="Operational action queue"');
    expect(source).toContain('Enquiries awaiting action');
    expect(source).toContain('Quotes requiring action');
    expect(source).toContain('Delivery evidence review');
  });

  it('preserves commercial and operational routes', () => {
    for (const route of ['/broker/post-load','/broker/compare-quotes','/broker/enquiries','/broker/pod-review','/broker/finance','/broker/margins','/broker/jobs']) expect(source).toContain(route);
  });

  it('retains truthful unavailable states for jobs, quotes and invoices', () => {
    expect(source).toContain("const jobsUnavailable = unavailable(data, ['jobs']);");
    expect(source).toContain("const quotesUnavailable = unavailable(data, ['jobs', 'bids']);");
    expect(source).toContain("const invoicesUnavailable = unavailable(data, ['invoices']);");
  });
});
