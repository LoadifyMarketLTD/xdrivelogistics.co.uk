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
  MEMBERSHIP_ROLE_PRECEDENCE,
  MEMBERSHIP_ROLE_CAPABILITIES,
  membershipHasCapability,
  resolveMembershipRole,
  isMembershipRoleAtLeast,
} from '../lib/membershipRole';

// ── 1. Type separation — BusinessWorkspace and MembershipRole are distinct ────

describe('BusinessWorkspace vs MembershipRole separation', () => {
  it('BusinessWorkspace values do not overlap with MembershipRole values', () => {
    const workspaces: BusinessWorkspace[] = [
      'owner_operator',
      'shipper',
      'broker',
      'carrier_fleet',
    ];
    const roles: MembershipRole[] = ['owner', 'admin', 'dispatcher', 'member', 'viewer'];

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

// ── 2. workspaceHasCapability ─────────────────────────────────────────────────

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

  it('returns false for an unknown capability', () => {
    expect(workspaceHasCapability('carrier_fleet', 'nonexistent.capability')).toBe(false);
  });
});

// ── 3. workspaceForRoute ──────────────────────────────────────────────────────

describe('workspaceForRoute — legacy route compatibility', () => {
  it('resolves /driver to owner_operator', () => {
    expect(workspaceForRoute('/driver')).toBe('owner_operator');
    expect(workspaceForRoute('/driver/jobs')).toBe('owner_operator');
    expect(workspaceForRoute('/driver/loads/search')).toBe('owner_operator');
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
    expect(workspaceForRoute('/admin/fleet')).toBe('carrier_fleet');
  });

  it('returns null for public / super-admin routes', () => {
    expect(workspaceForRoute('/')).toBeNull();
    expect(workspaceForRoute('/super-admin')).toBeNull();
    expect(workspaceForRoute('/login')).toBeNull();
    expect(workspaceForRoute('')).toBeNull();
  });

  it('strips query string and hash before matching', () => {
    expect(workspaceForRoute('/admin/jobs?status=active')).toBe('carrier_fleet');
    expect(workspaceForRoute('/customer?tab=loads#top')).toBe('shipper');
  });

  it('does not match partial prefix — /administration is not /admin', () => {
    expect(workspaceForRoute('/administration')).toBeNull();
    expect(workspaceForRoute('/customers')).toBeNull();
  });
});

// ── 4. MembershipRole capabilities ────────────────────────────────────────────

describe('membershipHasCapability', () => {
  it('owner has all capabilities', () => {
    expect(membershipHasCapability('owner', 'company.manage')).toBe(true);
    expect(membershipHasCapability('owner', 'jobs.dispatch')).toBe(true);
    expect(membershipHasCapability('owner', 'settings.manage')).toBe(true);
    expect(membershipHasCapability('owner', 'margins.view')).toBe(true);
  });

  it('dispatcher can dispatch and allocate but not manage company', () => {
    expect(membershipHasCapability('dispatcher', 'jobs.dispatch')).toBe(true);
    expect(membershipHasCapability('dispatcher', 'jobs.allocate')).toBe(true);
    expect(membershipHasCapability('dispatcher', 'company.manage')).toBe(false);
    expect(membershipHasCapability('dispatcher', 'settings.manage')).toBe(false);
  });

  it('member and viewer can only view jobs', () => {
    for (const role of ['member', 'viewer'] as MembershipRole[]) {
      expect(membershipHasCapability(role, 'jobs.view')).toBe(true);
      expect(membershipHasCapability(role, 'company.manage')).toBe(false);
      expect(membershipHasCapability(role, 'jobs.dispatch')).toBe(false);
      expect(membershipHasCapability(role, 'invoices.carrier.manage')).toBe(false);
    }
  });

  it('returns false for an unknown capability', () => {
    expect(membershipHasCapability('owner', 'does.not.exist')).toBe(false);
  });
});

// ── 5. resolveMembershipRole ──────────────────────────────────────────────────

describe('resolveMembershipRole', () => {
  it('passes through valid roles', () => {
    for (const role of MEMBERSHIP_ROLE_PRECEDENCE) {
      expect(resolveMembershipRole(role)).toBe(role);
    }
  });

  it('normalises uppercase input', () => {
    expect(resolveMembershipRole('OWNER')).toBe('owner');
    expect(resolveMembershipRole('Admin')).toBe('admin');
  });

  it('returns viewer for null', () => {
    expect(resolveMembershipRole(null)).toBe('viewer');
  });

  it('returns viewer for undefined', () => {
    expect(resolveMembershipRole(undefined)).toBe('viewer');
  });

  it('returns viewer for empty string', () => {
    expect(resolveMembershipRole('')).toBe('viewer');
  });

  it('returns viewer for unknown values like finance (not in DB enum yet)', () => {
    expect(resolveMembershipRole('finance')).toBe('viewer');
    expect(resolveMembershipRole('compliance')).toBe('viewer');
    expect(resolveMembershipRole('driver')).toBe('viewer');
  });
});

// ── 6. isMembershipRoleAtLeast ────────────────────────────────────────────────

describe('isMembershipRoleAtLeast', () => {
  it('owner is at least owner', () => {
    expect(isMembershipRoleAtLeast('owner', 'owner')).toBe(true);
  });

  it('owner is at least viewer', () => {
    expect(isMembershipRoleAtLeast('owner', 'viewer')).toBe(true);
  });

  it('viewer is NOT at least owner', () => {
    expect(isMembershipRoleAtLeast('viewer', 'owner')).toBe(false);
  });

  it('admin is at least dispatcher', () => {
    expect(isMembershipRoleAtLeast('admin', 'dispatcher')).toBe(true);
  });

  it('dispatcher is NOT at least admin', () => {
    expect(isMembershipRoleAtLeast('dispatcher', 'admin')).toBe(false);
  });
});
