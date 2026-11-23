import { describe, expect, it } from 'vitest';
import { membershipHasCapability, resolveMembershipRole } from '../lib/membershipRole';
import { hasWorkspaceCapabilityForContext } from '../lib/roleCapabilities';
import { resolveWorkspaceRole } from '../lib/workspaceRole';

const financeGrant = (profileRole: string, rawMemberRole: string | null) => {
  const membershipRole = resolveMembershipRole(rawMemberRole);
  if (!membershipRole) return false;
  if (!membershipHasCapability(membershipRole, 'invoices.customer.manage')
    && !membershipHasCapability(membershipRole, 'invoices.carrier.manage')) return false;
  const role = resolveWorkspaceRole({ role: profileRole, rawRole: profileRole, membershipRole });
  return hasWorkspaceCapabilityForContext(role, 'invoices.customer.manage', { membershipRole })
    || hasWorkspaceCapabilityForContext(role, 'invoices.carrier.manage', { membershipRole });
};

describe('Finance company membership authority', () => {
  it('denies restricted membership regardless of privileged legacy profile', () => {
    for (const member of ['dispatcher', 'driver', 'viewer', 'member', 'compliance', null]) {
      expect(financeGrant('company_admin', member), String(member)).toBe(false);
    }
  });
  it('retains legitimate finance company grants', () => {
    expect(financeGrant('company_admin', 'owner')).toBe(true);
    expect(financeGrant('company_admin', 'admin')).toBe(true);
    expect(financeGrant('company_admin', 'finance')).toBe(true);
    expect(financeGrant('company_admin', 'fleet_manager')).toBe(true);
  });
});
