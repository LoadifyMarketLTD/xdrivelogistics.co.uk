import { describe, it, expect } from 'vitest';
import {
  isWithinWorkspaceBoundary,
  getLandingRoute,
  getOutOfBoundaryRedirect,
  membershipCanAccessRoute,
} from '../lib/workspaceBoundary';
import type { BusinessWorkspace } from '../lib/businessWorkspace';
import type { MembershipRole } from '../lib/membershipRole';

describe('isWithinWorkspaceBoundary', () => {
  it('confirms canonical workspace route boundaries', () => {
    expect(isWithinWorkspaceBoundary('/driver/jobs', 'owner_operator')).toBe(true);
    expect(isWithinWorkspaceBoundary('/customer/post-load', 'shipper')).toBe(true);
    expect(isWithinWorkspaceBoundary('/broker/loads', 'broker')).toBe(true);
    expect(isWithinWorkspaceBoundary('/admin/marketplace', 'carrier_fleet')).toBe(true);
  });

  it('rejects cross-workspace routes', () => {
    expect(isWithinWorkspaceBoundary('/admin', 'shipper')).toBe(false);
    expect(isWithinWorkspaceBoundary('/customer', 'carrier_fleet')).toBe(false);
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

describe('getLandingRoute / getOutOfBoundaryRedirect', () => {
  it('returns canonical landing routes', () => {
    expect(getLandingRoute('owner_operator')).toBe('/driver');
    expect(getLandingRoute('shipper')).toBe('/customer');
    expect(getLandingRoute('broker')).toBe('/broker');
    expect(getLandingRoute('carrier_fleet')).toBe('/admin');
    expect(getLandingRoute(null)).toBe('/');
  });

  it('redirects only when crossing workspace boundaries', () => {
    expect(getOutOfBoundaryRedirect('/admin/marketplace', 'shipper')).toBe('/customer');
    expect(getOutOfBoundaryRedirect('/customer/loads', 'carrier_fleet')).toBe('/admin');
    expect(getOutOfBoundaryRedirect('/admin/jobs', 'carrier_fleet')).toBeNull();
    expect(getOutOfBoundaryRedirect('/login', 'carrier_fleet')).toBeNull();
  });
});

describe('membershipCanAccessRoute', () => {
  it('blocks super-admin routes for company membership roles', () => {
    const roles: MembershipRole[] = ['owner', 'admin', 'dispatcher', 'finance', 'compliance', 'driver', 'member', 'viewer'];
    for (const role of roles) {
      expect(membershipCanAccessRoute('/super-admin/users', role)).toBe(false);
    }
  });

  it('denies unknown /admin routes (fail-closed)', () => {
    expect(membershipCanAccessRoute('/admin/root-shell', 'owner')).toBe(false);
    expect(membershipCanAccessRoute('/admin/unknown/segment', 'admin')).toBe(false);
  });

  it('denies cross-workspace and URL manipulation attempts', () => {
    expect(membershipCanAccessRoute('/customer/loads', 'owner')).toBe(false);
    expect(membershipCanAccessRoute('/admin/%2e%2e/customer/loads', 'owner')).toBe(false);
  });

  it('enforces capability checks on mapped admin routes', () => {
    expect(membershipCanAccessRoute('/admin/operations-centre', 'dispatcher')).toBe(true);
    expect(membershipCanAccessRoute('/admin/operations-centre', 'viewer')).toBe(false);
    expect(membershipCanAccessRoute('/admin/invoices', 'finance')).toBe(true);
    expect(membershipCanAccessRoute('/admin/invoices', 'member')).toBe(false);
  });
});
