import type { BusinessWorkspace } from './businessWorkspace';

export type ProtectedRouteRequirement = {
  prefix: string;
  workspace: BusinessWorkspace;
  anyOf?: readonly string[];
};

export const PROTECTED_ROUTE_PREFIXES = ['/admin', '/broker', '/customer', '/driver'] as const;

export const PROTECTED_ROUTE_REQUIREMENTS: readonly ProtectedRouteRequirement[] = [
  { prefix: '/admin/fleet/assignments', workspace: 'carrier_fleet', anyOf: ['jobs.allocate'] },
  { prefix: '/admin/fleet/active-jobs', workspace: 'carrier_fleet', anyOf: ['jobs.track'] },
  { prefix: '/admin/fleet/future-availability', workspace: 'carrier_fleet', anyOf: ['drivers.manage'] },
  { prefix: '/admin/fleet/positions', workspace: 'carrier_fleet', anyOf: ['fleet.positions.view'] },
  { prefix: '/admin/fleet/maintenance', workspace: 'carrier_fleet', anyOf: ['fleet.maintenance.manage'] },
  { prefix: '/admin/fleet', workspace: 'carrier_fleet', anyOf: ['fleet.positions.view'] },
  { prefix: '/admin/operations-centre', workspace: 'carrier_fleet', anyOf: ['jobs.dispatch'] },
  { prefix: '/admin/marketplace', workspace: 'carrier_fleet', anyOf: ['loads.view.marketplace'] },
  { prefix: '/admin/quotes', workspace: 'carrier_fleet', anyOf: ['quotes.submit'] },
  { prefix: '/admin/bids', workspace: 'carrier_fleet', anyOf: ['jobs.view'] },
  { prefix: '/admin/diary', workspace: 'carrier_fleet', anyOf: ['jobs.dispatch', 'jobs.execute', 'jobs.view'] },
  { prefix: '/admin/jobs', workspace: 'carrier_fleet', anyOf: ['jobs.view'] },
  { prefix: '/admin/disputes', workspace: 'carrier_fleet', anyOf: ['incidents.manage'] },
  { prefix: '/admin/incidents', workspace: 'carrier_fleet', anyOf: ['incidents.manage'] },
  { prefix: '/admin/driver-availability', workspace: 'carrier_fleet', anyOf: ['drivers.manage'] },
  { prefix: '/admin/drivers', workspace: 'carrier_fleet', anyOf: ['drivers.manage'] },
  { prefix: '/admin/vehicles', workspace: 'carrier_fleet', anyOf: ['vehicles.manage'] },
  { prefix: '/admin/documents/expiry', workspace: 'carrier_fleet', anyOf: ['documents.company.manage', 'documents.verify'] },
  { prefix: '/admin/documents', workspace: 'carrier_fleet', anyOf: ['documents.company.manage', 'documents.verify'] },
  { prefix: '/admin/finance/payments', workspace: 'carrier_fleet', anyOf: ['payments.manage'] },
  { prefix: '/admin/finance/balances', workspace: 'carrier_fleet', anyOf: ['payments.manage', 'invoices.customer.manage', 'invoices.carrier.manage'] },
  { prefix: '/admin/finance/reports', workspace: 'carrier_fleet', anyOf: ['payments.manage', 'margins.view'] },
  { prefix: '/admin/finance', workspace: 'carrier_fleet', anyOf: ['payments.manage', 'margins.view', 'invoices.customer.manage', 'invoices.carrier.manage'] },
  { prefix: '/admin/invoices', workspace: 'carrier_fleet', anyOf: ['invoices.customer.manage', 'invoices.carrier.manage'] },
  { prefix: '/admin/returns', workspace: 'carrier_fleet', anyOf: ['jobs.view'] },
  { prefix: '/admin/dispatchers', workspace: 'carrier_fleet', anyOf: ['company.members.manage'] },
  { prefix: '/admin/settings', workspace: 'carrier_fleet', anyOf: ['settings.manage'] },
  { prefix: '/admin', workspace: 'carrier_fleet', anyOf: ['jobs.view'] },

  { prefix: '/broker/customers', workspace: 'broker', anyOf: ['company.manage'] },
  { prefix: '/broker/post-load', workspace: 'broker', anyOf: ['loads.create'] },
  { prefix: '/broker/loads', workspace: 'broker', anyOf: ['loads.view.own'] },
  { prefix: '/broker/bids', workspace: 'broker', anyOf: ['quotes.receive'] },
  { prefix: '/broker/compare-quotes', workspace: 'broker', anyOf: ['quotes.compare'] },
  { prefix: '/broker/awards', workspace: 'broker', anyOf: ['quotes.award'] },
  { prefix: '/broker/jobs', workspace: 'broker', anyOf: ['jobs.track'] },
  { prefix: '/broker/pod-review', workspace: 'broker', anyOf: ['jobs.review_pod'] },
  { prefix: '/broker/margins', workspace: 'broker', anyOf: ['margins.view'] },
  { prefix: '/broker/customer-invoices', workspace: 'broker', anyOf: ['invoices.customer.manage'] },
  { prefix: '/broker/carrier-costs', workspace: 'broker', anyOf: ['invoices.carrier.manage'] },
  { prefix: '/broker/disputes', workspace: 'broker', anyOf: ['incidents.manage'] },
  { prefix: '/broker/settings', workspace: 'broker', anyOf: ['settings.manage'] },
  { prefix: '/broker', workspace: 'broker', anyOf: ['loads.view.own'] },

  { prefix: '/customer/post-load', workspace: 'shipper', anyOf: ['loads.create'] },
  { prefix: '/customer/loads', workspace: 'shipper', anyOf: ['loads.view.own'] },
  { prefix: '/customer/quotes', workspace: 'shipper', anyOf: ['quotes.receive'] },
  { prefix: '/customer/awards', workspace: 'shipper', anyOf: ['quotes.award'] },
  { prefix: '/customer/deliveries', workspace: 'shipper', anyOf: ['jobs.track'] },
  { prefix: '/customer/jobs', workspace: 'shipper', anyOf: ['jobs.view'] },
  { prefix: '/customer/documents', workspace: 'shipper', anyOf: ['jobs.review_pod'] },
  { prefix: '/customer/invoices', workspace: 'shipper', anyOf: ['invoices.customer.manage'] },
  { prefix: '/customer/team', workspace: 'shipper', anyOf: ['settings.manage'] },
  { prefix: '/customer/settings', workspace: 'shipper', anyOf: ['settings.manage'] },
  { prefix: '/customer', workspace: 'shipper', anyOf: ['loads.view.own'] },

  { prefix: '/driver/change-password', workspace: 'owner_operator' },
  { prefix: '/driver/loads', workspace: 'owner_operator', anyOf: ['loads.view.marketplace'] },
  { prefix: '/driver/quotes', workspace: 'owner_operator', anyOf: ['quotes.submit'] },
  { prefix: '/driver/won-work', workspace: 'owner_operator', anyOf: ['jobs.view'] },
  { prefix: '/driver/finance', workspace: 'owner_operator', anyOf: ['invoices.carrier.manage'] },
  { prefix: '/driver/returns', workspace: 'owner_operator' },
  { prefix: '/driver/jobs', workspace: 'owner_operator', anyOf: ['jobs.execute'] },
  { prefix: '/driver/history', workspace: 'owner_operator', anyOf: ['jobs.view'] },
  { prefix: '/driver/availability', workspace: 'owner_operator' },
  { prefix: '/driver/vehicles', workspace: 'owner_operator' },
  { prefix: '/driver/documents', workspace: 'owner_operator', anyOf: ['documents.own.manage'] },
  { prefix: '/driver/messages', workspace: 'owner_operator' },
  { prefix: '/driver/profile', workspace: 'owner_operator' },
  { prefix: '/driver', workspace: 'owner_operator' },
];

export const cleanPathname = (pathname: string): string => {
  const clean = pathname.split('?')[0]?.split('#')[0] || '/';
  return clean.replace(/\/{2,}/g, '/');
};

const pathMatches = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export const isProtectedRoute = (pathname: string): boolean =>
  PROTECTED_ROUTE_PREFIXES.some((prefix) => pathMatches(pathname, prefix));

export const getProtectedRouteRequirement = (
  pathname: string,
): ProtectedRouteRequirement | null => {
  const clean = cleanPathname(pathname);
  let best: ProtectedRouteRequirement | null = null;
  for (const requirement of PROTECTED_ROUTE_REQUIREMENTS) {
    if (pathMatches(clean, requirement.prefix)) {
      if (!best || requirement.prefix.length > best.prefix.length) {
        best = requirement;
      }
    }
  }
  return best;
};
