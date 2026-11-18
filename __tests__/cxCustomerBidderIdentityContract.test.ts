import fs from 'node:fs';
import path from 'node:path';

const route = fs.readFileSync(path.join(process.cwd(), 'app/api/workspace/bids/identities/route.ts'), 'utf8');
const identityHelper = fs.readFileSync(path.join(process.cwd(), 'app/api/_lib/bidderDecisionIdentity.ts'), 'utf8');

describe('CX-close customer bidder identity resolution', () => {
  it('uses the existing owner-scoped bids view instead of inferred job relationships', () => {
    expect(route).toContain(".from('job_bids_with_job_owner')");
    expect(route).toContain(".in('owner_company_id', companyIds)");
    expect(route).toContain('bidder_company_id');
    expect(route).not.toContain("jobs!inner(company_id)");
  });

  it('keeps quote-decision identity access restricted to approved company roles', () => {
    expect(route).toContain("const BID_DECISION_MEMBERSHIP_ROLES = new Set(['owner', 'admin', 'dispatcher'])");
    expect(route).toContain(".eq('status', 'active')");
  });

  it('resolves carrier company and person display names through the canonical helper', () => {
    expect(route).toContain('enrichBidderDecisionIdentities');
    expect(identityHelper).toContain("admin.from('drivers')");
    expect(identityHelper).toContain("admin.from('profiles')");
    expect(identityHelper).toContain("admin.from('companies')");
    expect(identityHelper).toContain("displayName: companyName ?? personName ?? 'Carrier profile incomplete'");
  });
});
