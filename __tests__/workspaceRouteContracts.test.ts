import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getProtectedRouteRequirement } from '../lib/roleCapabilities';
import { getWorkspaceDefinition } from '../lib/workspaceRole';

const hrefs = (role: Parameters<typeof getWorkspaceDefinition>[0]) =>
  getWorkspaceDefinition(role).nav.flatMap((group) => group.items.map((item) => item.href));

const canonicalWorkspaceRoles = ['customer', 'fleet_manager', 'carrier_admin', 'broker'] as const;

const routePagePath = (href: string) =>
  resolve(process.cwd(), 'app', href.replace(/^\//, ''), 'page.tsx');

describe('workspace route contracts', () => {
  it('keeps the canonical Customer navigation matrix', () => {
    expect(hrefs('customer')).toEqual([
      '/customer',
      '/customer/loads',
      '/customer/quotes',
      '/customer/bookings',
      '/customer/tracking',
      '/customer/diary',
      '/customer/network',
      '/customer/account',
    ]);
  });

  it('keeps the canonical Fleet navigation matrix', () => {
    expect(hrefs('fleet_manager')).toEqual([
      '/admin/fleet',
      '/admin/fleet/jobs',
      '/admin/fleet/drivers',
      '/admin/fleet/vehicles',
      '/admin/fleet/availability',
      '/admin/fleet/returns',
      '/admin/diary',
      '/admin/finance',
      '/admin/fleet/compliance',
      '/admin/settings',
    ]);
  });

  it('keeps the canonical Carrier navigation matrix', () => {
    expect(hrefs('carrier_admin')).toEqual([
      '/admin',
      '/admin/marketplace',
      '/admin/quotes',
      '/admin/jobs',
      '/admin/fleet',
      '/admin/fleet/returns',
      '/admin/diary',
      '/admin/invoices',
      '/admin/documents',
      '/admin/settings',
    ]);
  });

  it('keeps the canonical Broker navigation matrix', () => {
    expect(hrefs('broker')).toEqual([
      '/broker',
      '/broker/enquiries',
      '/broker/loads',
      '/broker/bids',
      '/broker/jobs',
      '/broker/carrier-network',
      '/broker/customers',
      '/broker/diary',
      '/broker/finance',
      '/broker/account',
    ]);
  });

  it.each(canonicalWorkspaceRoles)('backs every canonical %s navigation entry with a real page', (role) => {
    for (const href of hrefs(role)) {
      expect(existsSync(routePagePath(href)), `${href} has no page.tsx`).toBe(true);
    }
  });

  it('authorizes the nested Directory entries through existing protected prefixes', () => {
    expect(getProtectedRouteRequirement('/customer/network/directory')?.prefix).toBe('/customer/network');
    expect(getProtectedRouteRequirement('/broker/carrier-network/directory')?.prefix).toBe('/broker/carrier-network');
    expect(getProtectedRouteRequirement('/admin/marketplace/directory')?.prefix).toBe('/admin/marketplace');
    expect(getProtectedRouteRequirement('/driver/loads/directory')?.prefix).toBe('/driver/loads');
  });
});
