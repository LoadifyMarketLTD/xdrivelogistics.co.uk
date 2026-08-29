import fs from 'node:fs';
import path from 'node:path';

describe('Broker CX convergence contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'app/broker/BrokerDashboardHome.tsx'),
    'utf8',
  );

  it('uses a left action centre with quote decisions as the primary activity canvas', () => {
    expect(source).toContain('Action Centre');
    expect(source).toContain('Quote decisions requiring action');
    expect(source).toContain('Live carrier execution');
    expect(source.indexOf('Action Centre')).toBeLessThan(source.indexOf('Commercial exposure'));
    expect(source.indexOf('Quote decisions requiring action')).toBeLessThan(source.indexOf('Commercial exposure'));
    expect(source.indexOf('Live carrier execution')).toBeLessThan(source.indexOf('Commercial exposure'));
  });

  it('removes the former sequential master action queue table', () => {
    expect(source).not.toContain('title="Operational action queue"');
    expect(source).toContain('<OperationalAttentionRail');
    expect(source).toContain('<OperationalAttentionItem');
  });

  it('preserves commercial and operational routes', () => {
    for (const route of [
      '/broker/post-load',
      '/broker/compare-quotes',
      '/broker/enquiries',
      '/broker/pod-review',
      '/broker/finance',
      '/broker/margins',
      '/broker/jobs',
    ]) {
      expect(source).toContain(route);
    }
  });

  it('retains truthful unavailable states for jobs, quotes and invoices', () => {
    expect(source).toContain("const jobsUnavailable = unavailable(data, ['jobs']);");
    expect(source).toContain("const quotesUnavailable = unavailable(data, ['jobs', 'bids']);");
    expect(source).toContain("const invoicesUnavailable = unavailable(data, ['invoices']);");
  });
});
