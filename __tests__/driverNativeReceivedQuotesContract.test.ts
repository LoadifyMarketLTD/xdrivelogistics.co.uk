import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Driver native received quotes contract', () => {
  it('keeps personal sent history separate from company received quotes', () => {
    const bids = read('app/api/driver/mobile/bids/route.ts');
    expect(bids).toContain("scope === 'received'");
    expect(bids).toContain("scope === 'active-company'");
    expect(bids).toContain("Driver mobile is the named driver's personal quote history");
    expect(bids).toContain("direction: 'received'");
  });

  it('requires an active owner/admin/dispatcher membership before exposing received quotes', () => {
    const bids = read('app/api/driver/mobile/bids/route.ts');
    expect(bids).toContain(".from('company_memberships')");
    expect(bids).toContain(".eq('user_id', driver.userId)");
    expect(bids).toContain(".eq('company_id', driver.companyId)");
    expect(bids).toContain(".eq('status', 'active')");
    expect(bids).toContain(".in('role_in_company', ['owner', 'admin', 'dispatcher'])");
    expect(bids).toContain('receivedCapability: false');
    expect(bids).toContain('receivedCapability: true');
  });

  it('limits received bids to jobs owned by the authenticated company', () => {
    const bids = read('app/api/driver/mobile/bids/route.ts');
    expect(bids).toContain(".from('jobs')");
    expect(bids).toContain(".eq('company_id', driver.companyId)");
    expect(bids).toContain(".in('job_id', jobIds)");
    expect(bids).toContain("canManage: bid.status === 'submitted'");
  });

  it('uses the existing authorised award and reject routes for received quote actions', () => {
    const award = read('app/api/customer/bids/[id]/award/route.ts');
    const reject = read('app/api/customer/bids/[id]/reject/route.ts');
    expect(award).toContain(".in('role_in_company', ['owner', 'admin', 'dispatcher'])");
    expect(award).toContain("'accept_job_bid_atomic'");
    expect(reject).toContain("bid.status !== 'submitted'");
    expect(reject).toContain("status: 'rejected'");
  });
});
