import { expect, test } from '@playwright/test';
import { selectDeterministicMembership } from '../lib/authContextResolver';
import { getWorkspaceHomeRoute, resolveWorkspaceRole } from '../lib/workspaceRole';

test.describe('role resolution regressions', () => {
  test('keeps profile owner exclusive to platform owner', () => {
    const user = { role: 'owner', rawRole: 'owner', membershipRole: 'owner' } as const;
    expect(resolveWorkspaceRole(user)).toBe('platform_owner');
    expect(getWorkspaceHomeRoute(user)).toBe('/super-admin');
  });

  test('routes canonical company admin owner to Fleet workspace', () => {
    const user = {
      role: 'company_admin',
      rawRole: 'company_admin',
      membershipRole: 'owner',
    } as const;
    expect(resolveWorkspaceRole(user)).toBe('fleet_manager');
    expect(getWorkspaceHomeRoute(user)).toBe('/admin/fleet');
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
      { id: 'newer', company_id: 'company-b', role_in_company: 'admin' },
      { id: 'preferred', company_id: 'company-a', role_in_company: 'owner' },
    ];
    expect(selectDeterministicMembership(memberships, 'company-a')?.id).toBe('preferred');
  });

  test('falls back to stable query order when no profile company matches', () => {
    const memberships = [
      { id: 'newest', company_id: 'company-b', role_in_company: 'admin' },
      { id: 'older', company_id: 'company-a', role_in_company: 'owner' },
    ];
    expect(selectDeterministicMembership(memberships, 'missing-company')?.id).toBe('newest');
    expect(selectDeterministicMembership([], 'company-a')).toBeNull();
  });
});
