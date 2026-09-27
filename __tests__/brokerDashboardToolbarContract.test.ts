import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('broker dashboard simplicity contract', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'app/broker/BrokerDashboardHome.tsx'), 'utf8');

  it('does not keep search toolbar state on the home dashboard', () => {
    expect(source).not.toContain('searchTerm');
    expect(source).not.toContain('savedView');
    expect(source).not.toContain('dateRange');
    expect(source).not.toContain('OperationalToolbar');
  });

  it('prioritises current lifecycle work over dashboard filtering controls', () => {
    expect(source).toContain('brokerJobPriority');
    expect(source).toContain('Current transport');
    expect(source).toContain('Needs your attention');
  });
});
