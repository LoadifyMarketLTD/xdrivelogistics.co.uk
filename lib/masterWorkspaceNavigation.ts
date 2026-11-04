/**
 * Canonical authenticated navigation. Every navigable tab is a real Next.js
 * route, not a locally rendered demonstration board.
 * Null means there is no authorized dedicated route for this role.
 */
export const MASTER_AUTHENTICATED_ROUTES = {
  'Company / Carrier': [
    '/admin', '/admin/post-load', '/admin/jobs', '/admin/exchange-quotes',
    '/admin/won-work', '/admin/fleet', '/admin/drivers', '/admin/diary',
    '/admin/invoices', '/admin/marketplace', '/admin/marketplace/directory',
    '/admin/live-availability', '/admin/returns', '/admin/freight-vision',
    '/admin/messages', '/admin/notifications', '/admin/finance/reports',
  ],
  Broker: [
    '/broker', '/broker/post-load', '/broker/loads', '/broker/bids',
    '/broker/jobs', '/broker/carrier-network', '/broker/team', '/broker/diary',
    '/broker/finance', '/broker/carrier-network', '/broker/customers',
    null, null, null,
    '/broker/messages', '/broker/notifications', '/broker/reports',
  ],
  Customer: [
    '/customer', '/customer/post-load', '/customer/loads', '/customer/quotes',
    '/customer/bookings', null, null, '/customer/diary',
    '/customer/invoices', '/customer/network', '/customer/network',
    null, null, null,
    '/customer/messages', '/customer/notifications', null,
  ],
  Driver: [
    '/driver', null, '/driver/loads', '/driver/quotes',
    '/driver/jobs', '/driver/vehicles', null, '/driver/history',
    null, '/driver/network', '/driver/directory',
    '/driver/availability', '/driver/returns', '/driver/freight-vision',
    '/driver/messages', '/driver/notifications', null,
  ],
  'Company Driver': [
    '/driver', null, '/driver/loads', '/driver/quotes',
    '/driver/jobs', null, null, '/driver/history',
    null, null, '/driver/directory',
    '/driver/availability', '/driver/returns', null,
    '/driver/messages', '/driver/notifications', null,
  ],
  'Employee Driver': [
    '/driver', null, '/driver/loads', null,
    '/driver/jobs', null, null, '/driver/history',
    null, null, '/driver/directory',
    '/driver/availability', '/driver/returns', null,
    '/driver/messages', '/driver/notifications', null,
  ],
  Fleet: [
    '/admin', '/admin/post-load', '/admin/jobs', '/admin/exchange-quotes',
    '/admin/won-work', '/admin/fleet', '/admin/drivers', '/admin/diary',
    '/admin/invoices', '/admin/marketplace', '/admin/marketplace/directory',
    '/admin/live-availability', '/admin/returns', '/admin/freight-vision',
    '/admin/messages', '/admin/notifications', '/admin/finance/reports',
  ],
  'Owner Driver': [
    '/driver', '/driver/post-load', '/driver/loads', '/driver/quotes',
    '/driver/jobs', '/driver/vehicles', null, '/driver/history',
    '/driver/finance', '/driver/network', '/driver/directory',
    '/driver/availability', '/driver/returns', '/driver/freight-vision',
    '/driver/messages', '/driver/notifications', null,
  ],
  Dispatcher: [
    '/admin', '/admin/post-load', '/admin/jobs', '/admin/exchange-quotes',
    '/admin/won-work', '/admin/fleet/assignments', '/admin/drivers', '/admin/diary',
    '/admin/invoices', '/admin/marketplace', '/admin/marketplace/directory',
    '/admin/live-availability', '/admin/returns', '/admin/freight-vision',
    '/admin/messages', '/admin/notifications', '/admin/finance/reports',
  ],
} as const satisfies Record<string, readonly (string|null)[]>;

export type MasterNavigationRole=keyof typeof MASTER_AUTHENTICATED_ROUTES;

export function masterNavigationHref(role:MasterNavigationRole,index:number):string|null {
  return MASTER_AUTHENTICATED_ROUTES[role][index]??null;
}
