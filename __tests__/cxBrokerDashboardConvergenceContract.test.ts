import fs from 'node:fs';
import path from 'node:path';

describe('Broker dashboard convergence contract', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'app/broker/BrokerDashboardHome.tsx'), 'utf8');

  it('is action-first and avoids dense duplicate dashboard modules', () => {
    for (const marker of ['Needs your attention','Quick actions','Current transport','Commercial position']) {
      expect(source).toContain(marker);
    }
    expect(source).not.toContain('<OperationalToolbar>');
    expect(source).not.toContain('<ExchangeKpiStrip>');
    expect(source).not.toContain('Quote decisions requiring action');
    expect(source).not.toContain('Live carrier execution');
  });

  it('keeps broker-only commercial context separate from shared execution', () => {
    expect(source).toContain('Revenue less carrier cost');
    expect(source).toContain('Awaiting customer payment');
    expect(source).toContain('Carrier costs');
    expect(source).toContain('Margin');
  });

  it('preserves operational routes', () => {
    for (const route of ['/broker/post-load','/broker/bids','/broker/enquiries','/broker/pod-review','/broker/finance','/broker/margins','/broker/jobs']) {
      expect(source).toContain(route);
    }
  });
});
