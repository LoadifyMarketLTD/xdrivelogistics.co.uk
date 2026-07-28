import { describe, it, expect } from 'vitest';
import {
  type BusinessWorkspace,
  WORKSPACE_LANDING_ROUTE,
  WORKSPACE_CAPABILITIES,
  workspaceHasCapability,
  workspaceForRoute,
} from '../lib/businessWorkspace';
import {
  type MembershipRole,
  type PersistedCompanyRole,
  MEMBERSHIP_ROLE_PRECEDENCE,
  MEMBERSHIP_ROLE_CAPABILITIES,
  membershipHasCapability,
  resolveMembershipRole,
  resolvePersistedCompanyRole,
  isMembershipRoleAtLeast,
} from '../lib/membershipRole';

describe('BusinessWorkspace vs MembershipRole separation', () => {
  it('BusinessWorkspace values do not overlap with MembershipRole values', () => {
    const workspaces: BusinessWorkspace[] = [
      'owner_operator',
      'shipper',
      'broker',
      'carrier_fleet',
    ];
    const roles: MembershipRole[] = [
      'owner',
      'admin',
      'dispatcher',
      'finance',
      'compliance',
      'driver',
      'member',
      'viewer',
    ];

    const intersection = workspaces.filter((w) =>
      (roles as string[]).includes(w),
    );
    expect(intersection).toHaveLength(0);
  });

  it('each BusinessWorkspace has a unique landing route', () => {
    const routes = Object.values(WORKSPACE_LANDING_ROUTE);
    const uniqueRoutes = new Set(routes);
    expect(uniqueRoutes.size).toBe(routes.length);
  });

  it('each BusinessWorkspace has at least one capability', () => {
    for (const [ws, caps] of Object.entries(WORKSPACE_CAPABILITIES)) {
      expect(caps.length, `${ws} should have capabilities`).toBeGreaterThan(0);
    }
  });

  it('each MembershipRole has at least one capability', () => {
    for (const [role, caps] of Object.entries(MEMBERSHIP_ROLE_CAPABILITIES)) {
      expect(caps.length, `${role} should have capabilities`).toBeGreaterThan(0);
    }
  });
});

describe('workspaceHasCapability', () => {
  it('owner_operator can submit quotes', () => {
    expect(workspaceHasCapability('owner_operator', 'quotes.submit')).toBe(true);
  });

  it('owner_operator cannot create loads', () => {
    expect(workspaceHasCapability('owner_operator', 'loads.create')).toBe(false);
  });

  it('shipper can create loads', () => {
    expect(workspaceHasCapability('shipper', 'loads.create')).toBe(true);
  });

  it('shipper cannot submit quotes', () => {
    expect(workspaceHasCapability('shipper', 'quotes.submit')).toBe(false);
  });

  it('broker can both create loads and submit quotes', () => {
    expect(workspaceHasCapability('broker', 'loads.create')).toBe(true);
    expect(workspaceHasCapability('broker', 'quotes.submit')).toBe(true);
  });

  it('carrier_fleet can allocate drivers', () => {
    expect(workspaceHasCapability('carrier_fleet', 'jobs.allocate')).toBe(true);
  });

  it('returns false for a capability not in the workspace', () => {
    // owner_operator cannot post loads or view margins — these belong to other workspaces
    expect(workspaceHasCapability('owner_operator', 'margins.view')).toBe(false);
    expect(workspaceHasCapability('owner_operator', 'loads.create')).toBe(false);
  });
});

describe('workspaceForRoute — legacy route compatibility', () => {
  it('resolves /driver to owner_operator', () => {
    expect(workspaceForRoute('/driver')).toBe('owner_operator');
    expect(workspaceForRoute('/driver/jobs')).toBe('owner_operator');
  });

  it('resolves /customer to shipper', () => {
    expect(workspaceForRoute('/customer')).toBe('shipper');
    expect(workspaceForRoute('/customer/post-load')).toBe('shipper');
  });

  it('resolves /broker to broker', () => {
    expect(workspaceForRoute('/broker')).toBe('broker');
    expect(workspaceForRoute('/broker/loads')).toBe('broker');
  });

  it('resolves /admin to carrier_fleet', () => {
    expect(workspaceForRoute('/admin')).toBe('carrier_fleet');
    expect(workspaceForRoute('/admin/marketplace')).toBe('carrier_fleet');
  });

  it('returns null for public / super-admin routes', () => {
    expect(workspaceForRoute('/')).toBeNull();
    expect(workspaceForRoute('/super-admin')).toBeNull();
    expect(workspaceForRoute('/login')).toBeNull();
  });

  it('strips query string and hash before matching', () => {
    expect(workspaceForRoute('/admin/jobs?status=active')).toBe('carrier_fleet');
    expect(workspaceForRoute('/customer?tab=loads#top')).toBe('shipper');
  });

  it('does not match partial prefix', () => {
    expect(workspaceForRoute('/administration')).toBeNull();
    expect(workspaceForRoute('/customers')).toBeNull();
  });
});

describe('membershipHasCapability', () => {
  it('owner has all capabilities', () => {
    expect(membershipHasCapability('owner', 'company.manage')).toBe(true);
    expect(membershipHasCapability('owner', 'jobs.dispatch')).toBe(true);
  });

  it('finance role keeps identity and capabilities', () => {
    expect(membershipHasCapability('finance', 'invoices.carrier.manage')).toBe(true);
    expect(membershipHasCapability('finance', 'drivers.manage')).toBe(false);
  });

  it('compliance role keeps identity and capabilities', () => {
    expect(membershipHasCapability('compliance', 'documents.company.manage')).toBe(true);
    expect(membershipHasCapability('compliance', 'invoices.carrier.manage')).toBe(false);
  });

  it('member and viewer can only view jobs', () => {
    for (const role of ['member', 'viewer'] as MembershipRole[]) {
      expect(membershipHasCapability(role, 'jobs.view')).toBe(true);
      expect(membershipHasCapability(role, 'company.manage')).toBe(false);
    }
  });
});

describe('role resolvers', () => {
  it('resolveMembershipRole preserves full application role identity', () => {
    expect(resolveMembershipRole('finance')).toBe('finance');
    expect(resolveMembershipRole('compliance')).toBe('compliance');
    expect(resolveMembershipRole('driver')).toBe('driver');
  });

  it('resolveMembershipRole fails closed on null/empty/unknown', () => {
    expect(resolveMembershipRole(null)).toBeNull();
    expect(resolveMembershipRole('')).toBeNull();
    expect(resolveMembershipRole('mystery')).toBeNull();
  });

  it('resolvePersistedCompanyRole only allows DB subset', () => {
    const persisted: PersistedCompanyRole[] = ['owner', 'admin', 'dispatcher', 'member', 'viewer'];
    for (const role of persisted) {
      expect(resolvePersistedCompanyRole(role)).toBe(role);
    }
    expect(resolvePersistedCompanyRole('finance')).toBeNull();
    expect(resolvePersistedCompanyRole('compliance')).toBeNull();
    expect(resolvePersistedCompanyRole('driver')).toBeNull();
  });

  it('isMembershipRoleAtLeast still orders privileged roles over viewer', () => {
    expect(isMembershipRoleAtLeast('owner', 'viewer')).toBe(true);
    expect(isMembershipRoleAtLeast('viewer', 'owner')).toBe(false);
    expect(MEMBERSHIP_ROLE_PRECEDENCE[0]).toBe('owner');
  });
});
