import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  composeBrokerPrimaryNav,
  composeBrokerPrototypeNav,
  composeCarrierPrimaryNav,
  composeCustomerPrimaryNav,
  composeCustomerPrototypeNav,
  composeDispatcherPrimaryNav,
  composeDriverPrimaryNav,
  composeFleetPrimaryNav,
  mergeCanonicalNavFallback,
} from '../app/components/workspace/TopWorkspaceShell';
import { getVisibleWorkspaceNav } from '../lib/workspaceRole';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');
const hrefs = (groups: Array<{ items: Array<{ href: string }> }>) =>
  groups.flatMap((group) => group.items.map((item) => item.href));

const expectVisible = (visible: Set<string>, routes: string[]) => {
  for (const href of routes) expect(visible.has(href), href).toBe(true);
};

describe('operational navigation remains reachable through primary, More, header, Settings or a canonical hub', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const settings = read('app/components/workspace/RoleSettingsWorkspace.tsx');

  it('keeps Customer frequent work visible and moves account/billing/notifications to their owning surfaces', () => {
    const canonical = getVisibleWorkspaceNav('customer');
    const merged = mergeCanonicalNavFallback(composeCustomerPrototypeNav(), canonical);
    const visible = new Set(hrefs(composeCustomerPrimaryNav(merged)));

    expectVisible(visible, [
      '/customer',
      '/customer/action-centre',
      '/customer/loads',
      '/customer/quotes',
      '/customer/bookings',
      '/customer/diary',
      '/customer/tracking',
      '/customer/network',
      '/customer/settings',
      '/customer/bulk-import',
      '/customer/deliveries',
      '/customer/documents',
      '/customer/updates',
      '/customer/messages',
      '/customer/disputes',
      '/customer/event-log',
      '/customer/invoices',
      '/customer/team',
    ]);
    expect(shell).toContain('onClick={() => router.push(notificationsHref)}');
    expect(settings).toContain("billing: '/customer/settings/billing'");
    expect(settings).toContain("legal: '/customer/account/legal-agreements'");
  });

  it('keeps Broker commercial operations visible and consolidates account/billing under Settings', () => {
    const canonical = getVisibleWorkspaceNav('broker');
    const merged = mergeCanonicalNavFallback(composeBrokerPrototypeNav(), canonical);
    const visible = new Set(hrefs(composeBrokerPrimaryNav(merged)));

    expectVisible(visible, [
      '/broker',
      '/broker/action-centre',
      '/broker/carrier-network/directory',
      '/broker/enquiries',
      '/broker/loads',
      '/broker/bids',
      '/broker/jobs',
      '/broker/diary',
      '/broker/pod-review',
      '/broker/finance',
      '/broker/settings',
      '/broker/bulk-import',
      '/broker/customers',
      '/broker/margins',
      '/broker/messages',
      '/broker/event-log',
      '/broker/disputes',
      '/broker/customer-invoices',
      '/broker/carrier-costs',
      '/broker/reports',
      '/broker/team',
    ]);
    expect(settings).toContain("billing: '/broker/settings/billing'");
    expect(settings).toContain("legal: '/broker/account/legal-agreements'");
  });

  it('keeps Carrier primary operations compact while fleet/team/billing detail is reachable from hubs', () => {
    const visible = new Set(hrefs(composeCarrierPrimaryNav(getVisibleWorkspaceNav('company_owner'))));
    expectVisible(visible, [
      '/admin',
      '/admin/marketplace/directory',
      '/admin/live-availability',
      '/admin/fleet/vehicles',
      '/admin/fleet/returns',
      '/admin/marketplace',
      '/admin/exchange',
      '/admin/diary',
      '/admin/freight-vision',
      '/admin/fleet/resources',
      '/admin/settings',
      '/admin/action-centre',
      '/admin/bulk-import',
      '/admin/jobs',
      '/admin/fleet/assignments',
      '/admin/pod',
      '/admin/invoices',
      '/admin/documents',
      '/admin/messages',
      '/admin/event-log',
    ]);

    const resources = read('app/admin/fleet/resources/page.tsx');
    expect(resources).toContain("router.push('/admin/fleet/positions')");
    expect(resources).toContain('Company Vehicles');
    expect(settings).toContain("team: '/admin/team'");
    expect(settings).toContain("billing: '/admin/settings/billing'");
    const team = read('app/admin/team/page.tsx');
    expect(team).toContain("router.push('/admin/fleet/managers')");
    expect(team).toContain("router.push('/admin/dispatchers')");
  });

  it('keeps Fleet Manager daily fleet modules visible while low-frequency tools stay in More', () => {
    const visible = new Set(hrefs(composeFleetPrimaryNav(getVisibleWorkspaceNav('fleet_manager'))));
    expectVisible(visible, [
      '/admin/fleet',
      '/admin/live-availability',
      '/admin/fleet/vehicles',
      '/admin/fleet/returns',
      '/admin/fleet/jobs',
      '/admin/diary',
      '/admin/freight-vision',
      '/admin/fleet/resources',
      '/admin/action-centre',
      '/admin/fleet/assignments',
      '/admin/fleet/maintenance',
      '/admin/incidents',
      '/admin/messages',
      '/admin/event-log',
      '/admin/invoices',
      '/admin/fleet/compliance',
    ]);
    const resources = read('app/admin/fleet/resources/page.tsx');
    expect(resources).toContain("router.push('/admin/fleet/positions')");
  });

  it('keeps Dispatcher focused on dispatch execution rather than duplicate Carrier browsing modules', () => {
    const visible = new Set(hrefs(composeDispatcherPrimaryNav(getVisibleWorkspaceNav('dispatcher'))));
    expectVisible(visible, [
      '/admin',
      '/admin/diary',
      '/admin/fleet/assignments',
      '/admin/fleet/active-jobs',
      '/admin/collections',
      '/admin/deliveries',
      '/admin/fleet/positions',
      '/admin/fleet/resources',
      '/admin/settings',
      '/admin/action-centre',
      '/admin/bulk-import',
      '/admin/incidents',
      '/admin/pod',
      '/admin/messages',
      '/admin/event-log',
    ]);
    expect(visible.has('/admin/fleet/vehicles')).toBe(false);
    expect(visible.has('/admin/fleet/returns')).toBe(false);
  });

  it('keeps Owner Driver commercial work visible and moves vehicle/tracking detail into My Fleet', () => {
    const visible = new Set(hrefs(composeDriverPrimaryNav(getVisibleWorkspaceNav('owner_driver'), true)));
    expectVisible(visible, [
      '/driver',
      '/driver/action-centre',
      '/driver/directory',
      '/driver/availability/live',
      '/driver/fleet',
      '/driver/returns',
      '/driver/loads',
      '/driver/quotes',
      '/driver/jobs',
      '/driver/history',
      '/driver/settings',
      '/driver/availability',
      '/driver/load-alerts',
      '/driver/nearby',
      '/driver/documents',
      '/driver/finance',
      '/driver/messages',
      '/driver/event-log',
    ]);

    const fleet = read('app/driver/_components/DriverFleetIntegratedNav.tsx');
    for (const href of ['/driver/vehicles', '/driver/drivers-vehicles', '/driver/freight-vision']) {
      expect(fleet).toContain(`href: '${href}'`);
    }
    const quotes = read('app/driver/quotes/page.tsx');
    expect(quotes).toContain("stage === 'archived' || stage === 'accepted'");
    expect(shell).toContain('onClick={() => router.push(notificationsHref)}');
  });

  it('keeps employed Driver execution-only and owns profile/security through Settings/header', () => {
    const visible = new Set(hrefs(composeDriverPrimaryNav(getVisibleWorkspaceNav('driver'), false)));
    expectVisible(visible, [
      '/driver',
      '/driver/action-centre',
      '/driver/jobs',
      '/driver/history',
      '/driver/availability',
      '/driver/vehicles',
      '/driver/documents',
      '/driver/settings',
      '/driver/messages',
      '/driver/event-log',
    ]);
    for (const commercial of ['/driver/loads', '/driver/quotes', '/driver/fleet', '/driver/returns']) {
      expect(visible.has(commercial), commercial).toBe(false);
    }
    expect(settings).toContain("legal: '/driver/account/legal-agreements'");
    expect(shell).toContain('onClick={() => router.push(notificationsHref)}');
  });

  it('does not expose a wrong fallback-role navbar before auth role resolution', () => {
    expect(shell).toContain('isLoading: authLoading');
    expect(shell).toContain('const workspaceRoleReady = Boolean(fixtureCompanyName || (!authLoading && user));');
    expect(shell).toContain('if (!workspaceRoleReady) return []');
    expect(shell).toContain('const accessibleBase = filterWorkspaceNavByAccess(base, role, user);');
    expect(shell).toContain('mergeCanonicalNavFallback(preferred, accessibleBase)');
    expect(shell).toContain('data-role-ready={workspaceRoleReady');
    expect(shell).toContain('{workspaceRoleReady && nav.map');
  });

  it('uses one shared tab geometry for Driver secondary workspace hubs', () => {
    const integratedNav = read('app/driver/_components/DriverIntegratedNav.tsx');
    const sharedTabs = read('app/components/workspace/WorkspaceUI.tsx');
    expect(integratedNav).toContain('<WorkspaceRouteTabs ariaLabel={label} items={items} />');
    expect(sharedTabs).toContain('.sort((a, b) => b.href.length - a.href.length)');
  });
});
