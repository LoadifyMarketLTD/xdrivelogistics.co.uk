import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getProtectedRouteRequirement } from '../lib/roleCapabilities';
import { getWorkspaceDefinition, type WorkspaceRole } from '../lib/workspaceRole';

const hrefs = (role: Parameters<typeof getWorkspaceDefinition>[0]) =>
  getWorkspaceDefinition(role).nav.flatMap((group) => group.items.map((item) => item.href));

const operationalWorkspaceRoles: WorkspaceRole[] = [
  'company_owner',
  'company_admin',
  'carrier_admin',
  'broker',
  'customer',
  'fleet_manager',
  'dispatcher',
  'driver',
  'owner_driver',
  'finance',
  'compliance',
  'viewer',
];

const routePagePath = (href: string) => {
  const pathname = href.split('?')[0]?.split('#')[0] ?? href;
  return resolve(process.cwd(), 'app', pathname.replace(/^\//, ''), 'page.tsx');
};

describe('workspace route contracts', () => {
  it('keeps the canonical Customer navigation matrix', () => {
    expect(hrefs('customer')).toEqual([
      '/customer',
      '/customer/loads',
      '/customer/bulk-import',
      '/customer/quotes',
      '/customer/bookings',
      '/customer/tracking',
      '/customer/diary',
      '/customer/documents',
      '/customer/invoices',
      '/customer/notifications',
      '/customer/messages',
      '/customer/event-log',
      '/customer/network',
      '/customer/disputes',
      '/customer/settings/billing',
      '/customer/account',
    ]);
  });

  it('keeps the canonical Fleet navigation matrix', () => {
    expect(hrefs('fleet_manager')).toEqual([
      '/admin/fleet',
      '/admin/fleet/jobs',
      '/admin/fleet/assignments',
      '/admin/fleet/drivers',
      '/admin/fleet/vehicles',
      '/admin/fleet/availability',
      '/admin/fleet/future-availability',
      '/admin/fleet/positions',
      '/admin/fleet/returns',
      '/admin/fleet/maintenance',
      '/admin/incidents',
      '/admin/diary',
      '/admin/freight-vision',
      '/admin/messages',
      '/admin/event-log',
      '/admin/invoices',
      '/admin/fleet/compliance',
      '/admin/settings',
    ]);
  });

  it('keeps the canonical Carrier navigation matrix', () => {
    expect(hrefs('carrier_admin')).toEqual([
      '/admin',
      '/admin/marketplace',
      '/admin/marketplace/directory',
      '/admin/live-availability',
      '/admin/freight-vision',
      '/admin/exchange-quotes',
      '/admin/won-work',
      '/admin/jobs',
      '/admin/bulk-import',
      '/admin/pod',
      '/admin/fleet/assignments',
      '/admin/fleet/resources',
      '/admin/drivers',
      '/admin/vehicles',
      '/admin/fleet/positions',
      '/admin/fleet',
      '/admin/fleet/managers',
      '/admin/team',
      '/admin/dispatchers',
      '/admin/fleet/returns',
      '/admin/diary',
      '/admin/messages',
      '/admin/event-log',
      '/admin/invoices',
      '/admin/finance/statements',
      '/admin/finance/reports',
      '/admin/documents',
      '/admin/settings/billing',
      '/admin/settings',
    ]);
  });

  it('keeps the canonical Broker navigation matrix', () => {
    expect(hrefs('broker')).toEqual([
      '/broker',
      '/broker/enquiries',
      '/broker/loads',
      '/broker/bulk-import',
      '/broker/bids',
      '/broker/jobs',
      '/broker/pod-review',
      '/broker/carrier-network',
      '/broker/customers',
      '/broker/diary',
      '/broker/messages',
      '/broker/event-log',
      '/broker/disputes',
      '/broker/finance',
      '/broker/reports',
      '/broker/settings/billing',
      '/broker/account',
    ]);
  });

  it.each(operationalWorkspaceRoles)('backs every canonical %s navigation entry with a real page', (role) => {
    for (const href of hrefs(role)) {
      expect(existsSync(routePagePath(href)), `${href} has no page.tsx`).toBe(true);
    }
  });

  it('authorizes canonical Directory routes and retains legacy aliases only as compatibility redirects', () => {
    expect(getProtectedRouteRequirement('/customer/network/directory')?.prefix).toBe('/customer/network');
    expect(getProtectedRouteRequirement('/broker/carrier-network/directory')?.prefix).toBe('/broker/carrier-network');
    expect(getProtectedRouteRequirement('/admin/marketplace/directory')?.prefix).toBe('/admin/marketplace');
    expect(getProtectedRouteRequirement('/driver/loads/directory')?.prefix).toBe('/driver/loads/directory');
    expect(getProtectedRouteRequirement('/driver/network')?.prefix).toBe('/driver/network');

    const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');
    expect(read('app/driver/network/page.tsx')).toContain("redirect('/driver/directory')");
    expect(read('app/driver/loads/directory/page.tsx')).toContain("redirect('/driver/directory')");
    expect(read('app/driver/account/page.tsx')).toContain("redirect('/driver/profile')");
    expect(read('app/driver/account/profile/page.tsx')).toContain("redirect('/driver/profile')");
  });

  it('maps Dispatcher execution queues and spreadsheet surfaces to explicit protected route requirements', () => {
    expect(getProtectedRouteRequirement('/admin/collections')?.anyOf).toEqual(expect.arrayContaining(['jobs.dispatch', 'jobs.track']));
    expect(getProtectedRouteRequirement('/admin/deliveries')?.anyOf).toEqual(expect.arrayContaining(['jobs.dispatch', 'jobs.track']));
    expect(getProtectedRouteRequirement('/customer/bulk-import')?.anyOf).toContain('loads.create');
    expect(getProtectedRouteRequirement('/broker/bulk-import')?.anyOf).toContain('loads.create');
    expect(getProtectedRouteRequirement('/admin/bulk-import')?.roles).toContain('dispatcher');
    expect(getProtectedRouteRequirement('/admin/finance/reports')?.anyOf).toContain('invoices.carrier.manage');
  });
});
