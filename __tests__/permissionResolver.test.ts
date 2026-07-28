import { describe, it, expect } from 'vitest';
import {
  resolvePermission,
  type PermissionInput,
} from '../lib/permissionResolver';
import type { BusinessWorkspace } from '../lib/businessWorkspace';
import type { MembershipRole } from '../lib/membershipRole';

// ── Helpers ───────────────────────────────────────────────────────────────────

function input(overrides: Partial<PermissionInput> = {}): PermissionInput {
  return {
    companyId: 'co-1',
    membershipRole: 'owner',
    enabledWorkspaces: ['carrier_fleet'],
    activeWorkspace: 'carrier_fleet',
    ...overrides,
  };
}

// ── 1. Basic allow ────────────────────────────────────────────────────────────

describe('resolvePermission — allow', () => {
  it('allows when all conditions satisfied', () => {
    expect(resolvePermission(input())).toEqual({ allowed: true });
  });

  it('allows owner with required capability jobs.dispatch', () => {
    expect(resolvePermission(input({ requiredCapability: 'jobs.dispatch' }))).toEqual({ allowed: true });
  });

  it('allows without capability check when requiredCapability is not provided', () => {
    expect(resolvePermission(input({ membershipRole: 'viewer' }))).toEqual({ allowed: true });
  });

  it('allows shipper context for /customer route', () => {
    expect(resolvePermission(input({
      enabledWorkspaces: ['shipper'],
      activeWorkspace: 'shipper',
      targetPathname: '/customer/loads',
    }))).toEqual({ allowed: true });
  });
});

// ── 2. no_company ─────────────────────────────────────────────────────────────

describe('resolvePermission — no_company', () => {
  it('denies when companyId is empty', () => {
    const result = resolvePermission(input({ companyId: '' }));
    expect(result).toEqual({ allowed: false, reason: 'no_company' });
  });

  it('denies when companyId is whitespace', () => {
    const result = resolvePermission(input({ companyId: '   ' }));
    expect(result).toEqual({ allowed: false, reason: 'no_company' });
  });
});

// ── 3. workspace_not_enabled ──────────────────────────────────────────────────

describe('resolvePermission — workspace_not_enabled', () => {
  it('denies when activeWorkspace is not in enabledWorkspaces', () => {
    const result = resolvePermission(input({
      enabledWorkspaces: ['shipper'],
      activeWorkspace: 'carrier_fleet',
    }));
    expect(result).toEqual({ allowed: false, reason: 'workspace_not_enabled' });
  });

  it('denies when enabledWorkspaces is empty', () => {
    const result = resolvePermission(input({
      enabledWorkspaces: [] as unknown as BusinessWorkspace[],
      activeWorkspace: 'carrier_fleet',
    }));
    expect(result).toEqual({ allowed: false, reason: 'workspace_not_enabled' });
  });
});

// ── 4. cross_workspace_access ─────────────────────────────────────────────────

describe('resolvePermission — cross_workspace_access', () => {
  it('denies when targetPathname belongs to a different workspace', () => {
    const result = resolvePermission(input({
      enabledWorkspaces: ['carrier_fleet'],
      activeWorkspace: 'carrier_fleet',
      targetPathname: '/customer/loads', // shipper route
    }));
    expect(result).toEqual({ allowed: false, reason: 'cross_workspace_access' });
  });

  it('denies shipper trying to access /admin route', () => {
    const result = resolvePermission(input({
      enabledWorkspaces: ['shipper'],
      activeWorkspace: 'shipper',
      targetPathname: '/admin/jobs',
    }));
    expect(result).toEqual({ allowed: false, reason: 'cross_workspace_access' });
  });

  it('denies broker trying to access /driver route', () => {
    const result = resolvePermission(input({
      enabledWorkspaces: ['broker'],
      activeWorkspace: 'broker',
      targetPathname: '/driver/jobs',
    }));
    expect(result).toEqual({ allowed: false, reason: 'cross_workspace_access' });
  });

  it('allows public routes (no workspace prefix)', () => {
    const result = resolvePermission(input({ targetPathname: '/login' }));
    expect(result).toEqual({ allowed: true });
  });
});

// ── 5. capability_denied ──────────────────────────────────────────────────────

describe('resolvePermission — capability_denied', () => {
  it('denies viewer requesting jobs.dispatch capability', () => {
    const result = resolvePermission(input({
      membershipRole: 'viewer',
      requiredCapability: 'jobs.dispatch',
    }));
    expect(result).toEqual({ allowed: false, reason: 'capability_denied' });
  });

  it('denies member requesting company.manage capability', () => {
    const result = resolvePermission(input({
      membershipRole: 'member',
      requiredCapability: 'company.manage',
    }));
    expect(result).toEqual({ allowed: false, reason: 'capability_denied' });
  });

  it('denies dispatcher requesting invoices.carrier.manage', () => {
    const result = resolvePermission(input({
      membershipRole: 'dispatcher',
      requiredCapability: 'invoices.carrier.manage',
    }));
    expect(result).toEqual({ allowed: false, reason: 'capability_denied' });
  });

  it('allows finance requesting invoices.carrier.manage', () => {
    const result = resolvePermission(input({
      membershipRole: 'finance',
      requiredCapability: 'invoices.carrier.manage',
    }));
    expect(result).toEqual({ allowed: true });
  });

  it('allows compliance requesting drivers.manage', () => {
    const result = resolvePermission(input({
      membershipRole: 'compliance',
      requiredCapability: 'drivers.manage',
    }));
    expect(result).toEqual({ allowed: true });
  });
});

// ── 6. route_not_permitted ────────────────────────────────────────────────────

describe('resolvePermission — route_not_permitted (carrier_fleet)', () => {
  it('denies viewer accessing /admin/operations-centre', () => {
    const result = resolvePermission(input({
      membershipRole: 'viewer',
      targetPathname: '/admin/operations-centre',
    }));
    expect(result).toEqual({ allowed: false, reason: 'route_not_permitted' });
  });

  it('denies member accessing /admin/settings', () => {
    const result = resolvePermission(input({
      membershipRole: 'member',
      targetPathname: '/admin/settings',
    }));
    expect(result).toEqual({ allowed: false, reason: 'route_not_permitted' });
  });

  it('allows owner accessing /admin/operations-centre', () => {
    expect(resolvePermission(input({
      membershipRole: 'owner',
      targetPathname: '/admin/operations-centre',
    }))).toEqual({ allowed: true });
  });

  it('always denies /super-admin regardless of role', () => {
    const roles: MembershipRole[] = ['owner', 'admin', 'dispatcher', 'member', 'viewer'];
    for (const role of roles) {
      const result = resolvePermission(input({
        membershipRole: role,
        targetPathname: '/super-admin/users',
      }));
      expect(result).toEqual({ allowed: false, reason: 'route_not_permitted' });
    }
  });
});

// ── 7. Evaluation order ───────────────────────────────────────────────────────

describe('resolvePermission — evaluation order', () => {
  it('no_company is reported before workspace_not_enabled', () => {
    const result = resolvePermission(input({
      companyId: '',
      enabledWorkspaces: [],
      activeWorkspace: 'carrier_fleet',
    }));
    expect(result).toEqual({ allowed: false, reason: 'no_company' });
  });

  it('workspace_not_enabled is reported before cross_workspace_access', () => {
    const result = resolvePermission(input({
      enabledWorkspaces: ['broker'],
      activeWorkspace: 'carrier_fleet', // not in enabled
      targetPathname: '/customer/loads', // also wrong
    }));
    expect(result).toEqual({ allowed: false, reason: 'workspace_not_enabled' });
  });
});
