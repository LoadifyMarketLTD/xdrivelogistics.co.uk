import { describe, expect, it } from 'vitest';

import {
  normalizeAuthMembershipRows,
  resolveAuthActiveCompanySelection,
} from '../lib/authActiveCompanyContext';
import { resolveActiveCompanyContext } from '../lib/activeWorkspace';
import { findScopedDriverEvidence } from '../lib/bootstrapProfileRole';

type MembershipInput = {
  id: string;
  companyId: string;
  role?: string;
  companyType?: string;
  companyStatus?: string;
  membershipStatus?: string;
};

const membershipRow = (input: MembershipInput) => ({
  id: input.id,
  company_id: input.companyId,
  user_id: 'user-1',
  role_in_company: input.role ?? 'owner',
  status: input.membershipStatus ?? 'active',
  companies: {
    id: input.companyId,
    name: `Company ${input.companyId}`,
    company_type: input.companyType ?? 'standard',
    status: input.companyStatus ?? 'active',
  },
});

describe('auth active-company selection consistency', () => {
  it('fails closed for multiple active memberships without trusted company selection', () => {
    const memberships = normalizeAuthMembershipRows([
      membershipRow({ id: 'mem-a', companyId: 'company-a' }),
      membershipRow({ id: 'mem-b', companyId: 'company-b' }),
    ]);

    const result = resolveAuthActiveCompanySelection({ memberships });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('active_company_required');
    }
  });

  it('fails closed when profile.company_id is outside active memberships', () => {
    const memberships = normalizeAuthMembershipRows([
      membershipRow({ id: 'mem-a', companyId: 'company-a' }),
    ]);

    const result = resolveAuthActiveCompanySelection({
      memberships,
      preferredCompanyId: 'company-stale',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('no_active_membership');
    }
  });

  it('selects deterministically when exactly one active membership exists', () => {
    const memberships = normalizeAuthMembershipRows([
      membershipRow({ id: 'mem-a', companyId: 'company-a' }),
    ]);

    const result = resolveAuthActiveCompanySelection({ memberships });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.companyId).toBe('company-a');
      expect(result.membershipId).toBe('mem-a');
      expect(result.membership.company_id).toBe('company-a');
    }
  });

  it('keeps membershipId/companyId/driverId in one context and ignores driver rows from other companies', () => {
    const memberships = normalizeAuthMembershipRows([
      membershipRow({ id: 'mem-b', companyId: 'company-b', role: 'admin' }),
    ]);
    const selected = resolveAuthActiveCompanySelection({ memberships });

    expect(selected.ok).toBe(true);
    if (!selected.ok) return;

    const scopedDriver = findScopedDriverEvidence({
      drivers: [
        { id: 'drv-a', user_id: 'user-1', company_id: 'company-a' },
        { id: 'drv-b', user_id: 'user-1', company_id: 'company-b' },
      ],
      sessionUserId: 'user-1',
      selectedCompanyId: selected.companyId,
    });

    expect(selected.membershipId).toBe('mem-b');
    expect(selected.companyId).toBe('company-b');
    expect(scopedDriver?.id).toBe('drv-b');
    expect(scopedDriver?.company_id).toBe(selected.companyId);
  });

  it('supports owner-driver and single-company company-driver contexts without arbitrary selection', () => {
    const ownerMemberships = normalizeAuthMembershipRows([
      membershipRow({ id: 'mem-owner', companyId: 'company-owner', role: 'owner' }),
    ]);
    const companyDriverMemberships = normalizeAuthMembershipRows([
      membershipRow({ id: 'mem-driver', companyId: 'company-driver', role: 'member' }),
    ]);

    const ownerResult = resolveAuthActiveCompanySelection({ memberships: ownerMemberships });
    const driverResult = resolveAuthActiveCompanySelection({ memberships: companyDriverMemberships });

    expect(ownerResult.ok).toBe(true);
    expect(driverResult.ok).toBe(true);
  });

  it('matches middleware active-company resolver semantics for stale profile selection', () => {
    const memberships = normalizeAuthMembershipRows([
      membershipRow({ id: 'mem-a', companyId: 'company-a' }),
      membershipRow({ id: 'mem-b', companyId: 'company-b' }),
    ]);

    const authSelection = resolveAuthActiveCompanySelection({
      memberships,
      preferredCompanyId: 'company-stale',
    });
    const middlewareSelection = resolveActiveCompanyContext(memberships, {
      preferredCompanyId: 'company-stale',
    });

    expect(authSelection.ok).toBe(false);
    expect(middlewareSelection.ok).toBe(false);
    if (!authSelection.ok && !middlewareSelection.ok) {
      expect(authSelection.error).toBe(middlewareSelection.error);
    }
  });
});
