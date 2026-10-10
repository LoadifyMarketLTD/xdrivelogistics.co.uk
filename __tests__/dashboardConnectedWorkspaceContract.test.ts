import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('connected workspace dashboard completion', () => {
  const roles = read('lib/workspaceRole.ts');
  const access = read('lib/roleCapabilities.ts');
  const customer = read('app/customer/CustomerDashboardHome.tsx');
  const broker = read('app/broker/BrokerDashboardHome.tsx');
  const carrier = read('app/components/workspace/CarrierOperationsDashboardHome.tsx');
  const fleet = read('app/components/workspace/FleetControlDashboardHome.tsx');
  const driver = read('app/driver/page.tsx');

  it('connects customer messaging, event log and disputes from the dashboard and navigation', () => {
    expect(roles).toContain("href: '/customer/messages'");
    expect(roles).toContain("href: '/customer/event-log'");
    expect(customer).toContain('/customer/messages?jobId=');
    expect(roles).toContain("href: '/customer/event-log'");
    expect(roles).toContain("href: '/customer/disputes'");
    expect(customer).toContain('/customer/messages?jobId=');
  });

  it('connects broker messages and event log with route access', () => {
    expect(roles).toContain("href: '/broker/messages'");
    expect(roles).toContain("href: '/broker/event-log'");
    expect(access).toContain("{ prefix: '/broker/messages', workspace: 'broker' }");
    expect(access).toContain("{ prefix: '/broker/event-log', workspace: 'broker', anyOf: ['jobs.view'] }");
    expect(broker).toContain("router.push('/broker/messages')");
    expect(broker).toContain("router.push('/broker/event-log')");
  });

  it('keeps carrier directory, availability, Freight Vision, messages and event log reachable from canonical navigation while the dashboard stays action-focused', () => {
    const routes = ['/admin/marketplace/directory', '/admin/live-availability', '/admin/freight-vision', '/admin/messages', '/admin/event-log'];
    for (const route of routes) expect(roles).toContain("href: '" + route + "'");
    expect(carrier).toContain("router.push('/admin/live-availability')");
    expect(carrier).toContain("router.push('/admin/marketplace')");
    expect(carrier).toContain("router.push('/admin/fleet/active-jobs')");
  });

  it('connects fleet finance, Freight Vision, messages and event log', () => {
    expect(roles).toContain("'invoices.carrier.manage'");
    const routes = ['/admin/invoices', '/admin/freight-vision', '/admin/messages', '/admin/event-log'];
    for (const route of routes) {
      expect(fleet).toContain("router.push('" + route + "')");
    }
  });

  it('gives owner drivers a distinct commercial position while keeping it conditional', () => {
    expect(driver).toContain('{ownerDriver ? (');
    expect(driver).toContain('Reports & Statistics');
    expect(driver).toContain('Accounts Payable');
    expect(driver).toContain('Feedback in Last 90 Days');
    expect(driver).toContain('Activity at a glance');
    expect(driver).toContain('/api/driver/dashboard/commercial-summary');
  });
});
