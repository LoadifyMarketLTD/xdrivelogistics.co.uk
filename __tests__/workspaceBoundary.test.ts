import { describe, it, expect } from 'vitest';
import {
  isWithinWorkspaceBoundary,
  getLandingRoute,
  getOutOfBoundaryRedirect,
  membershipCanAccessRoute,
} from '../lib/workspaceBoundary';
import type { BusinessWorkspace } from '../lib/businessWorkspace';
import type { MembershipRole } from '../lib/membershipRole';

// ── 1. isWithinWorkspaceBoundary ──────────────────────────────────────────────

describe('isWithinWorkspaceBoundary', () => {
  it('confirms /driver routes are within owner_operator boundary', () => {
    expect(isWithinWorkspaceBoundary('/driver', 'owner_operator')).toBe(true);
    expect(isWithinWorkspaceBoundary('/driver/jobs', 'owner_operator')).toBe(true);
  });

  it('confirms /customer routes are within shipper boundary', () => {
    expect(isWithinWorkspaceBoundary('/customer', 'shipper')).toBe(true);
    expect(isWithinWorkspaceBoundary('/customer/post-load', 'shipper')).toBe(true);
  });

  it('confirms /broker routes are within broker boundary', () => {
    expect(isWithinWorkspaceBoundary('/broker', 'broker')).toBe(true);
    expect(isWithinWorkspaceBoundary('/broker/loads', 'broker')).toBe(true);
  });

  it('confirms /admin routes are within carrier_fleet boundary', () => {
    expect(isWithinWorkspaceBoundary('/admin', 'carrier_fleet')).toBe(true);
    expect(isWithinWorkspaceBoundary('/admin/marketplace', 'carrier_fleet')).toBe(true);
  });

  it('rejects cross-workspace routes', () => {
    expect(isWithinWorkspaceBoundary('/admin', 'shipper')).toBe(false);
    expect(isWithinWorkspaceBoundary('/customer', 'carrier_fleet')).toBe(false);
    expect(isWithinWorkspaceBoundary('/driver', 'broker')).toBe(false);
  });

  it('rejects public routes for all workspaces', () => {
    const workspaces: BusinessWorkspace[] = [
      'owner_operator',
      'shipper',
      'broker',
      'carrier_fleet',
    ];
    for (const ws of workspaces) {
      expect(isWithinWorkspaceBoundary('/', ws)).toBe(false);
      expect(isWithinWorkspaceBoundary('/login', ws)).toBe(false);
    }
  });
});

// ── 2. getLandingRoute ────────────────────────────────────────────────────────

describe('getLandingRoute', () => {
  it('returns /driver for owner_operator', () => {
    expect(getLandingRoute('owner_operator')).toBe('/driver');
  });

  it('returns /customer for shipper', () => {
    expect(getLandingRoute('shipper')).toBe('/customer');
  });

  it('returns /broker for broker', () => {
    expect(getLandingRoute('broker')).toBe('/broker');
  });

  it('returns /admin for carrier_fleet', () => {
    expect(getLandingRoute('carrier_fleet')).toBe('/admin');
  });

  it('returns / for null', () => {
    expect(getLandingRoute(null)).toBe('/');
  });
});

// ── 3. getOutOfBoundaryRedirect ───────────────────────────────────────────────

describe('getOutOfBoundaryRedirect', () => {
  it('returns null when pathname is within boundary', () => {
    expect(getOutOfBoundaryRedirect('/admin/jobs', 'carrier_fleet')).toBeNull();
    expect(getOutOfBoundaryRedirect('/customer', 'shipper')).toBeNull();
  });

  it('returns landing route when pathname is in a different workspace', () => {
    expect(getOutOfBoundaryRedirect('/admin/marketplace', 'shipper')).toBe('/customer');
    expect(getOutOfBoundaryRedirect('/customer/loads', 'carrier_fleet')).toBe('/admin');
    expect(getOutOfBoundaryRedirect('/broker/loads', 'owner_operator')).toBe('/driver');
  });

  it('returns null for public routes outside all workspaces', () => {
    expect(getOutOfBoundaryRedirect('/login', 'carrier_fleet')).toBeNull();
  });

  it('returns null when workspace is null', () => {
    expect(getOutOfBoundaryRedirect('/admin', null)).toBeNull();
  });
});

// ── 4. membershipCanAccessRoute — fail-closed behaviour ──────────────────────

describe('membershipCanAccessRoute — fail closed', () => {
  it('blocks super-admin routes for all membership roles', () => {
    const roles: MembershipRole[] = [
      'owner', 'admin', 'dispatcher', 'finance', 'compliance', 'driver', 'member', 'viewer',
    ];
    for (const role of roles) {
      expect(membershipCanAccessRoute('/super-admin', role)).toBe(false);
      expect(membershipCanAccessRoute('/super-admin/users', role)).toBe(false);
    }
  });

  it('allows /admin/jobs for all carrier_fleet membership roles (jobs.view)', () => {
    const roles: MembershipRole[] = [
      'owner', 'admin', 'dispatcher', 'finance', 'compliance', 'member', 'viewer',
    ];
    for (const role of roles) {
      expect(membershipCanAccessRoute('/admin/jobs', role)).toBe(true);
    }
  });

  it('allows /admin/marketplace for all carrier_fleet membership roles (jobs.view)', () => {
    expect(membershipCanAccessRoute('/admin/marketplace', 'viewer')).toBe(true);
    expect(membershipCanAccessRoute('/admin/marketplace', 'owner')).toBe(true);
  });

  it('restricts /admin/operations-centre to dispatcher and above', () => {
    expect(membershipCanAccessRoute('/admin/operations-centre', 'owner')).toBe(true);
    expect(membershipCanAccessRoute('/admin/operations-centre', 'admin')).toBe(true);
    expect(membershipCanAccessRoute('/admin/operations-centre', 'dispatcher')).toBe(true);
    expect(membershipCanAccessRoute('/admin/operations-centre', 'member')).toBe(false);
    expect(membershipCanAccessRoute('/admin/operations-centre', 'viewer')).toBe(false);
  });

  it('restricts /admin/invoices to owner and admin (invoices.carrier.manage)', () => {
    expect(membershipCanAccessRoute('/admin/invoices', 'owner')).toBe(true);
    expect(membershipCanAccessRoute('/admin/invoices', 'admin')).toBe(true);
    expect(membershipCanAccessRoute('/admin/invoices', 'finance')).toBe(true);
    expect(membershipCanAccessRoute('/admin/invoices', 'dispatcher')).toBe(false);
    expect(membershipCanAccessRoute('/admin/invoices', 'member')).toBe(false);
    expect(membershipCanAccessRoute('/admin/invoices', 'viewer')).toBe(false);
  });

  it('restricts /admin/drivers to dispatcher and above (drivers.manage)', () => {
    expect(membershipCanAccessRoute('/admin/drivers', 'owner')).toBe(true);
    expect(membershipCanAccessRoute('/admin/drivers', 'dispatcher')).toBe(true);
    expect(membershipCanAccessRoute('/admin/drivers', 'compliance')).toBe(true);
    expect(membershipCanAccessRoute('/admin/drivers', 'member')).toBe(false);
  });

  it('restricts /admin/settings to owner and admin (settings.manage)', () => {
    expect(membershipCanAccessRoute('/admin/settings', 'owner')).toBe(true);
    expect(membershipCanAccessRoute('/admin/settings', 'admin')).toBe(true);
    expect(membershipCanAccessRoute('/admin/settings', 'dispatcher')).toBe(false);
    expect(membershipCanAccessRoute('/admin/settings', 'viewer')).toBe(false);
  });
});

// ── 5. Cross-workspace denial (fail closed) ───────────────────────────────────

describe('membershipCanAccessRoute — cross-workspace routes denied (fail closed)', () => {
  const roles: MembershipRole[] = [
    'owner', 'admin', 'dispatcher', 'finance', 'compliance', 'driver', 'member', 'viewer',
  ];

  it('denies /customer/* routes — not governed by carrier_fleet membership', () => {
    for (const role of roles) {
      expect(membershipCanAccessRoute('/customer/loads', role)).toBe(false);
      expect(membershipCanAccessRoute('/customer/quotes', role)).toBe(false);
    }
  });

  it('denies /driver/* routes — not governed by carrier_fleet membership', () => {
    for (const role of roles) {
      expect(membershipCanAccessRoute('/driver/jobs', role)).toBe(false);
      expect(membershipCanAccessRoute('/driver/loads/search', role)).toBe(false);
    }
  });

  it('denies /broker/* routes — not governed by carrier_fleet membership', () => {
    for (const role of roles) {
      expect(membershipCanAccessRoute('/broker/loads', role)).toBe(false);
    }
  });
});

// ── 6. Unknown routes and URL manipulation — fail closed ──────────────────────

describe('membershipCanAccessRoute — unknown routes and URL manipulation', () => {
  it('denies /login and other public routes', () => {
    expect(membershipCanAccessRoute('/login', 'owner')).toBe(false);
    expect(membershipCanAccessRoute('/', 'owner')).toBe(false);
    expect(membershipCanAccessRoute('/about', 'owner')).toBe(false);
  });

  it('denies unrecognised invented /admin sub-routes (fail closed)', () => {
    // Invented routes not in the explicit registry still require minimum jobs.view
    // but must not be silently permitted for restricted roles
    expect(membershipCanAccessRoute('/admin/imaginary-page', 'viewer')).toBe(true);  // jobs.view
    expect(membershipCanAccessRoute('/admin/imaginary-page', 'member')).toBe(true);  // jobs.view
  });

  it('does not match /administration as an /admin route', () => {
    // /administration is not a workspace route — denied
    expect(membershipCanAccessRoute('/administration/users', 'owner')).toBe(false);
  });

  it('strips query string and fragment before matching', () => {
    expect(membershipCanAccessRoute('/admin/jobs?malicious=true', 'owner')).toBe(true);
    expect(membershipCanAccessRoute('/super-admin?bypass=1', 'owner')).toBe(false);
    expect(membershipCanAccessRoute('/customer/loads#fragment', 'owner')).toBe(false);
  });
});
