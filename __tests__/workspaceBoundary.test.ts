import { describe, it, expect } from 'vitest';
import {
  isWithinWorkspaceBoundary,
  getLandingRoute,
  getOutOfBoundaryRedirect,
} from '../lib/workspaceBoundary';
import type { BusinessWorkspace } from '../lib/businessWorkspace';

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
