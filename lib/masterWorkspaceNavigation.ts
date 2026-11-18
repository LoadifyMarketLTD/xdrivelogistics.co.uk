/**
 * Canonical authenticated navigation. Every navigable tab is a real Next.js
 * route, not a locally rendered demonstration board.
 * Null means there is no authorized dedicated route for this role.
 */
export const MASTER_AUTHENTICATED_ROUTES = {
  'Company / Carrier': [
    '/admin', '/admin/post-load', '/admin/marketplace', '/admin/exchange',
    '/admin/won-work', '/admin/fleet', '/admin/drivers', '/admin/diary',
    '/admin/invoices', '/admin/network-tools', '/admin/marketplace/directory',
    '/admin/live-availability', '/admin/fleet/returns', '/admin/freight-vision',
    '/admin/messages', '/admin/notifications', '/admin/reports',
  ],
  Broker: [
    '/broker', '/broker/post-load', '/broker/loads', '/broker/bids',
    '/broker/jobs', '/broker/fleet', '/broker/drivers', '/broker/diary',
    '/broker/finance', '/broker/carrier-network', '/broker/directory',
    '/broker/live-availability', '/broker/returns', '/broker/freight-vision',
    '/broker/messages', '/broker/notifications', '/broker/reports',
  ],
  Customer: [
    '/customer', '/customer/post-load', '/customer/loads', '/customer/quotes',
    '/customer/bookings', '/customer/fleet', '/customer/drivers', '/customer/diary',
    '/customer/invoices', '/customer/network', '/customer/directory',
    '/customer/live-availability', '/customer/returns', '/customer/freight-vision',
    '/customer/messages', '/customer/notifications', '/customer/reports',
  ],
  Driver: [
    '/driver', null, '/driver/loads', '/driver/quotes',
    '/driver/jobs', '/driver/fleet', '/driver/drivers', '/driver/history',
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
    '/admin', '/admin/post-load', '/admin/marketplace', '/admin/exchange',
    '/admin/won-work', '/admin/fleet', '/admin/drivers', '/admin/diary',
    '/admin/invoices', '/admin/network-tools', '/admin/marketplace/directory',
    '/admin/live-availability', '/admin/fleet/returns', '/admin/freight-vision',
    '/admin/messages', '/admin/notifications', '/admin/reports',
  ],
  'Owner Driver': [
    '/driver', '/driver/post-load', '/driver/loads', '/driver/quotes',
    '/driver/jobs', '/driver/fleet', '/driver/drivers', '/driver/history',
    '/driver/finance', '/driver/network', '/driver/directory',
    '/driver/availability', '/driver/returns', '/driver/freight-vision',
    '/driver/messages', '/driver/notifications', '/driver/reports',
  ],
  Dispatcher: [
    '/admin', '/admin/post-load', '/admin/marketplace', '/admin/exchange',
    '/admin/won-work', '/admin/fleet', '/admin/drivers', '/admin/diary',
    '/admin/invoices', '/admin/network-tools', '/admin/marketplace/directory',
    '/admin/live-availability', '/admin/fleet/returns', '/admin/freight-vision',
    '/admin/messages', '/admin/notifications', '/admin/reports',
  ],
} as const satisfies Record<string, readonly (string|null)[]>;

export type MasterNavigationRole=keyof typeof MASTER_AUTHENTICATED_ROUTES;

export function masterNavigationHref(role:MasterNavigationRole,index:number):string|null {
  return MASTER_AUTHENTICATED_ROUTES[role][index]??null;
}
