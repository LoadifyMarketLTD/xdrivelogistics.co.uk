import { expect, test } from '@playwright/test';
import { selectDeterministicMembership } from '../lib/authContextResolver';
import { resolveWorkspaceRawRole } from '../lib/workspaceIdentity';
import { getWorkspaceHomeRoute, resolveWorkspaceRole } from '../lib/workspaceRole';

test.describe('role resolution regressions', () => {
  test('keeps profile owner exclusive to platform owner', () => {
    const user = { role: 'owner', rawRole: 'owner', membershipRole: 'owner' } as const;
    expect(resolveWorkspaceRole(user)).toBe('platform_owner');
    expect(getWorkspaceHomeRoute(user)).toBe('/super-admin');
  });

  test('routes an explicitly identified Fleet Operator to Fleet workspace', () => {
    const rawRole = resolveWorkspaceRawRole({
      profileRole: 'company_admin',
      userMetadata: {
        requested_role: 'fleet_operator',
        account_type: 'fleet_courier',
      },
    });
    const user = {
      role: 'company_admin',
      rawRole,
      membershipRole: 'owner',
    } as const;

    expect(rawRole).toBe('fleet_operator');
    expect(resolveWorkspaceRole(user)).toBe('fleet_manager');
    expect(getWorkspaceHomeRoute(user)).toBe('/admin/fleet');
  });

  test('does not classify a generic company admin owner as Fleet', () => {
    const rawRole = resolveWorkspaceRawRole({
      profileRole: 'company_admin',
      userMetadata: { requested_role: 'company_admin' },
    });
    const user = {
      role: 'company_admin',
      rawRole,
      membershipRole: 'owner',
    } as const;

    expect(rawRole).toBe('company_admin');
    expect(resolveWorkspaceRole(user)).toBe('company_owner');
    expect(getWorkspaceHomeRoute(user)).toBe('/admin');
  });

  test('does not elevate customer company owner to Fleet or platform workspace', () => {
    const user = { role: 'customer', rawRole: 'customer', membershipRole: 'owner' } as const;
    expect(resolveWorkspaceRole(user)).toBe('customer');
    expect(getWorkspaceHomeRoute(user)).toBe('/customer');
  });

  test('keeps a member driver in Driver workspace', () => {
    const user = { role: 'driver', rawRole: 'driver', membershipRole: 'member' } as const;
    expect(resolveWorkspaceRole(user)).toBe('driver');
    expect(getWorkspaceHomeRoute(user)).toBe('/driver');
  });

  test('selects the membership matching profiles.company_id', () => {
    const memberships = [
      {
        id: 'newer',
        company_id: 'company-b',
        role_in_company: 'admin',
        created_at: '2026-07-23T10:00:00Z',
      },
      {
        id: 'preferred',
        company_id: 'company-a',
        role_in_company: 'owner',
        created_at: '2026-07-22T10:00:00Z',
      },
    ];
    expect(selectDeterministicMembership(memberships, 'company-a')?.id).toBe('preferred');
  });

  test('uses newest membership when no profile company matches', () => {
    const memberships = [
      {
        id: 'older',
        company_id: 'company-a',
        role_in_company: 'owner',
        created_at: '2026-07-22T10:00:00Z',
      },
      {
        id: 'newest',
        company_id: 'company-b',
        role_in_company: 'admin',
        created_at: '2026-07-23T10:00:00Z',
      },
    ];
    expect(selectDeterministicMembership(memberships, 'missing-company')?.id).toBe('newest');
  });

  test('breaks created_at ties by stable id regardless of input order', () => {
    const createdAt = '2026-07-23T10:00:00Z';
    const firstOrder = [
      { id: 'b', company_id: 'company-b', created_at: createdAt },
      { id: 'a', company_id: 'company-a', created_at: createdAt },
    ];
    const reverseOrder = [...firstOrder].reverse();

    expect(selectDeterministicMembership(firstOrder, null)?.id).toBe('a');
    expect(selectDeterministicMembership(reverseOrder, null)?.id).toBe('a');
    expect(selectDeterministicMembership([], 'company-a')).toBeNull();
  });
});
