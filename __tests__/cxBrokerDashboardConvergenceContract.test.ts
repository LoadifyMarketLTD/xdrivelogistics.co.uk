import fs from 'node:fs';
import path from 'node:path';

describe('Broker dashboard convergence contract', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'app/broker/BrokerDashboardHome.tsx'), 'utf8');
  const shell = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/TopWorkspaceShell.tsx'), 'utf8');

  it('is action-first and avoids dense duplicate dashboard modules', () => {
    for (const marker of ['Needs your attention','Current transport','Commercial position']) {
      expect(source).toContain(marker);
    }
    expect(source).not.toContain('<OperationalToolbar>');
    expect(source).not.toContain('<ExchangeKpiStrip>');
    expect(source).not.toContain('Quote decisions requiring action');
    expect(source).not.toContain('Live carrier execution');
    expect(source).not.toContain('Quick actions');
  });

  it('keeps broker-only commercial context separate from shared execution', () => {
    expect(source).toContain('Revenue less carrier cost');
    expect(source).toContain('Awaiting customer payment');
    expect(source).toContain('Carrier costs');
    expect(source).toContain('Margin');
  });

  it('preserves operational routes', () => {
    for (const route of ['/broker/bids','/broker/enquiries','/broker/pod-review','/broker/finance','/broker/margins','/broker/jobs']) {
      expect(source + shell).toContain(route);
    }
    expect(source).not.toContain("router.push('/broker/post-load')");
  });
});
