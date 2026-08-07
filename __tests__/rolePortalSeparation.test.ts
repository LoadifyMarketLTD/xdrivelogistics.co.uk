import { describe, expect, it } from 'vitest';

import { resolveAuthoritativeRole } from '../lib/authRole';
import { getWorkspaceHomeRoute, resolveWorkspaceRole } from '../lib/workspaceRole';

describe('role portal separation', () => {
  it('keeps a trusted broker app_metadata role out of a stale company-admin profile workspace', () => {
    const role = resolveAuthoritativeRole({
      membershipRole: null,
      profileRole: 'company_admin',
      isDriver: false,
      hasCreatedCompany: false,
      fallbackRole: 'broker',
      ownerDriverWorkspaceRequested: false,
    });

    expect(role).toBe('broker');

    const workspaceRole = resolveWorkspaceRole({
      role,
      rawRole: 'company_admin',
      membershipRole: null,
      ownerDriverWorkspace: false,
    });

    expect(workspaceRole).toBe('broker');
    expect(getWorkspaceHomeRoute({ role, rawRole: 'company_admin' })).toBe('/broker');
  });

  it('keeps a trusted customer app_metadata role out of a stale company-admin profile workspace', () => {
    const role = resolveAuthoritativeRole({
      membershipRole: null,
      profileRole: 'company_admin',
      isDriver: false,
      hasCreatedCompany: false,
      fallbackRole: 'customer',
      ownerDriverWorkspaceRequested: false,
    });

    expect(role).toBe('customer');
    expect(resolveWorkspaceRole({ role, rawRole: 'company_admin' })).toBe('customer');
    expect(getWorkspaceHomeRoute({ role, rawRole: 'company_admin' })).toBe('/customer');
  });

  it('does not promote a stale driver metadata role without driver evidence', () => {
    const role = resolveAuthoritativeRole({
      membershipRole: 'admin',
      profileRole: 'company_admin',
      isDriver: false,
      hasCreatedCompany: false,
      fallbackRole: 'driver',
      ownerDriverWorkspaceRequested: false,
    });

    expect(role).toBe('company_admin');
  });
});
