import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'app/customer/jobs/[id]/page.tsx'), 'utf8');

describe('CX-close customer carrier quote comparison', () => {
  it('makes quote comparison explicit before award', () => {
    expect(source).toContain('Compare carrier quotes');
    expect(source).toContain('Lowest visible price');
    expect(source).toContain('vs lowest visible quote');
    expect(source).toContain('Award / Book');
  });

  it('keeps member identity/profile inspection in the decision table', () => {
    expect(source).toContain('MemberIdentityLink');
    expect(source).toContain('Open member profile before award');
  });

  it('does not fabricate reputation or ETA fields absent from the current quote projection', () => {
    expect(source).toContain('Reputation/ETA fields are not fabricated');
    expect(source).toContain('remain separate parity-ledger fields');
  });

  it('preserves the existing customer award endpoint', () => {
    expect(source).toContain('`/api/customer/bids/${bidId}/award`');
    expect(source).toContain("method: 'POST'");
  });

  it('does not touch Super Admin', () => {
    expect(source).not.toContain('/super-admin');
  });
});
