import type { AppUserRole } from './authRole';

export type WorkspaceRole =
  | 'platform_owner'
  | 'company_owner'
  | 'company_admin'
  | 'carrier_admin'
  | 'broker'
  | 'customer'
  | 'fleet_manager'
  | 'dispatcher'
  | 'driver'
  | 'owner_driver'
  | 'finance'
  | 'compliance'
  | 'viewer';

export type WorkspaceCapability =
  | 'platform.manage'
  | 'company.manage'
  | 'company.members.manage'
  | 'billing.manage'
  | 'loads.create'
  | 'loads.publish'
  | 'loads.view.own'
  | 'loads.view.marketplace'
  | 'quotes.submit'
  | 'quotes.receive'
  | 'quotes.compare'
  | 'quotes.award'
  | 'jobs.view'
  | 'jobs.allocate'
  | 'jobs.dispatch'
  | 'jobs.execute'
  | 'jobs.track'
  | 'jobs.review_pod'
  | 'drivers.manage'
  | 'vehicles.manage'
  | 'fleet.positions.view'
  | 'fleet.maintenance.manage'
  | 'documents.own.manage'
  | 'documents.company.manage'
  | 'documents.verify'
  | 'invoices.customer.manage'
  | 'invoices.carrier.manage'
  | 'payments.manage'
  | 'margins.view'
  | 'incidents.manage'
  | 'settings.manage';

export type WorkspaceNavItem = {
  id: string;
  label: string;
  href: string;
  icon?: string;
  capability?: WorkspaceCapability;
};

export type WorkspaceNavGroup = {
  id: string;
  label: string;
  items: WorkspaceNavItem[];
};

export type WorkspaceDefinition = {
  role: WorkspaceRole;
  label: string;
  subtitle: string;
  homeHref: string;
  primaryAction?: { label: string; href: string; capability?: WorkspaceCapability };
  nav: WorkspaceNavGroup[];
};

export type WorkspaceUserLike = {
  role?: AppUserRole | string | null;
  rawRole?: string | null;
  membershipRole?: string | null;
  ownerDriverWorkspace?: boolean | null;
  financeAccess?: 'full' | 'limited' | 'hidden' | null;
};

const normalized = (value: string | null | undefined) => (value ?? '').toLowerCase().trim().replace(/[-\s]+/g, '_');

const normalizePathname = (pathname: string) => pathname.split('?')[0]?.split('#')[0] || '/';

export const resolveWorkspaceRole = (user: WorkspaceUserLike | null | undefined): WorkspaceRole => {
  if (!user) return 'viewer';

  const appRole = normalized(typeof user.role === 'string' ? user.role : null);
  const rawRole = normalized(user.rawRole);
  const membershipRole = normalized(user.membershipRole);

  if (appRole === 'owner' || rawRole === 'platform_owner' || rawRole === 'super_admin' || rawRole === 'platform_admin') {
    return 'platform_owner';
  }
  if (appRole === 'broker' || rawRole.includes('broker')) return 'broker';
  if (appRole === 'customer' || rawRole === 'customer' || rawRole === 'shipper' || rawRole === 'customer_shipper') return 'customer';

  if (
    membershipRole === 'owner' && (
      user.ownerDriverWorkspace === true ||
      ['owner_driver', 'owner_operator', 'self_employed', 'self_employed_driver', 'sole_trader'].includes(rawRole)
    )
  ) {
    return 'owner_driver';
  }

  if (membershipRole === 'owner') return 'company_owner';
  if (membershipRole === 'admin' || appRole === 'company_admin') return rawRole === 'carrier' ? 'carrier_admin' : 'company_admin';

  if (
    user.ownerDriverWorkspace === true ||
    ['owner_driver', 'owner_operator', 'self_employed', 'self_employed_driver', 'sole_trader'].includes(rawRole)
  ) {
    return 'owner_driver';
  }

  if (appRole === 'driver' || rawRole === 'driver' || rawRole === 'company_driver' || rawRole === 'solo_driver') return 'driver';

  if (rawRole === 'fleet_operator' || rawRole === 'fleet_manager' || rawRole === 'fleet_admin' || membershipRole === 'fleet_manager') return 'fleet_manager';
  if (rawRole === 'dispatcher' || rawRole === 'operations_controller' || membershipRole === 'dispatcher') return 'dispatcher';
  if (rawRole === 'finance' || rawRole === 'accounting' || rawRole === 'accountant' || membershipRole === 'finance') return 'finance';
  if (rawRole === 'compliance' || rawRole === 'compliance_manager' || membershipRole === 'compliance') return 'compliance';
  if (rawRole === 'viewer' || membershipRole === 'viewer') return 'viewer';

  if (appRole === 'company_staff' || membershipRole === 'member') return 'carrier_admin';

  return 'viewer';
};

const ALL_COMPANY_MANAGEMENT: WorkspaceCapability[] = [
  'company.manage',
  'company.members.manage',
  'billing.manage',
  'settings.manage',
];

const CARRIER_COMMERCIAL: WorkspaceCapability[] = [
  'loads.view.marketplace',
  'quotes.submit',
  'jobs.view',
  'jobs.allocate',
  'jobs.dispatch',
  'jobs.track',
  'jobs.review_pod',
  'drivers.manage',
  'vehicles.manage',
  'fleet.positions.view',
  'fleet.maintenance.manage',
  'documents.company.manage',
  'invoices.carrier.manage',
  'incidents.manage',
];

export const DRIVER_WORKSPACE_CAPABILITIES: readonly WorkspaceCapability[] = [
  'loads.view.marketplace',
  'quotes.submit',
  'jobs.view',
  'jobs.execute',
  'jobs.track',
  'vehicles.manage',
  'documents.own.manage',
  'settings.manage',
];

const DRIVER_EXECUTION_NAV: WorkspaceNavGroup[] = [
  { id: 'home', label: 'Driver', items: [
    { id: 'today', label: 'Today', href: '/driver', icon: 'HOME' },
    { id: 'action-centre', label: 'Action Centre', href: '/driver/action-centre', icon: '!' },
  ] },
  { id: 'operations', label: 'My Work', items: [
    { id: 'jobs', label: 'My Jobs', href: '/driver/jobs', icon: '▣' },
    { id: 'diary', label: 'Diary', href: '/driver/history', icon: '□' },
    { id: 'availability', label: 'Availability', href: '/driver/availability', icon: '◷' },
  ] },
  { id: 'readiness', label: 'Driver', items: [
    { id: 'vehicle', label: 'Vehicle', href: '/driver/vehicles', icon: '▰' },
    { id: 'documents', label: 'Documents', href: '/driver/documents', icon: '▤' },
    { id: 'notifications', label: 'Notifications', href: '/driver/notifications', icon: '●' },
    { id: 'messages', label: 'Messages', href: '/driver/messages', icon: '◫' },
    { id: 'security', label: 'Security', href: '/driver/change-password', icon: '⚙' },
    { id: 'event-log', label: 'Event Log', href: '/driver/event-log', icon: '≡', capability: 'jobs.view' },
    { id: 'profile', label: 'Account', href: '/driver/profile', icon: '◉' },
    { id: 'settings', label: 'Driver Settings', href: '/driver/settings', icon: '⚙', capability: 'settings.manage' },
  ] },
];

const OWNER_DRIVER_NAV: WorkspaceNavGroup[] = [
  ...DRIVER_EXECUTION_NAV,
  { id: 'commercial', label: 'Commercial', items: [
    { id: 'live-availability', label: 'Live Availability', href: '/driver/availability/live', icon: '◷' },
    { id: 'loads', label: 'Loads', href: '/driver/loads', icon: '▦' },
    { id: 'quotes', label: 'Quotes', href: '/driver/quotes', icon: '◫' },
    { id: 'won-work', label: 'Won Work', href: '/driver/won-work', icon: '✓' },
    { id: 'auto-match', label: 'Auto-match & Alerts', href: '/driver/load-alerts', icon: '◷' },
    { id: 'nearby', label: "Who's Nearby", href: '/driver/nearby', icon: '⌖' },
    { id: 'tracking', label: 'Tracking', href: '/driver/freight-vision', icon: '◎' },
    { id: 'directory', label: 'Directory', href: '/driver/directory', icon: '⊕' },
    { id: 'returns', label: 'Return Journeys', href: '/driver/returns', icon: '↩' },
  ] },
  { id: 'business', label: 'Business', items: [
    { id: 'invoices', label: 'Invoices', href: '/driver/finance', icon: '£', capability: 'invoices.carrier.manage' },
    { id: 'company-profile', label: 'Company Profile', href: '/driver/settings?section=company', icon: '◎' },
    { id: 'drivers-staff', label: 'Drivers & Staff', href: '/driver/drivers-vehicles', icon: '◎' },
    { id: 'manage-drivers', label: 'Manage Drivers', href: '/driver/drivers', icon: 'DRV', capability: 'drivers.manage' },
    { id: 'settings', label: 'Company Settings', href: '/driver/settings?section=overview', icon: '⚙' },
    { id: 'billing', label: 'Membership & Billing', href: '/driver/settings/billing', icon: '£', capability: 'billing.manage' },
  ] },
];

const CAPABILITIES: Record<WorkspaceRole, ReadonlySet<WorkspaceCapability>> = {
  platform_owner: new Set<WorkspaceCapability>(['platform.manage', ...ALL_COMPANY_MANAGEMENT.filter((capability) => capability !== 'billing.manage'), ...CARRIER_COMMERCIAL, 'loads.create', 'loads.publish', 'loads.view.own', 'quotes.receive', 'quotes.compare', 'quotes.award', 'jobs.execute', 'documents.own.manage', 'documents.verify', 'invoices.customer.manage', 'payments.manage', 'margins.view']),
  company_owner: new Set<WorkspaceCapability>([...ALL_COMPANY_MANAGEMENT, ...CARRIER_COMMERCIAL, 'loads.create', 'loads.publish', 'loads.view.own', 'quotes.receive', 'quotes.compare', 'quotes.award', 'invoices.customer.manage', 'payments.manage', 'margins.view']),
  company_admin: new Set<WorkspaceCapability>([...ALL_COMPANY_MANAGEMENT, ...CARRIER_COMMERCIAL, 'loads.create', 'loads.publish', 'loads.view.own', 'quotes.receive', 'quotes.compare', 'quotes.award', 'invoices.customer.manage', 'payments.manage', 'margins.view']),
  carrier_admin: new Set<WorkspaceCapability>([...CARRIER_COMMERCIAL, 'loads.create', 'loads.publish', 'loads.view.own', 'quotes.receive', 'quotes.compare', 'quotes.award']),
  broker: new Set<WorkspaceCapability>(['company.manage', 'billing.manage', 'loads.create', 'loads.publish', 'loads.view.own', 'quotes.receive', 'quotes.compare', 'quotes.award', 'jobs.view', 'jobs.track', 'jobs.review_pod', 'documents.company.manage', 'invoices.customer.manage', 'invoices.carrier.manage', 'margins.view', 'incidents.manage', 'settings.manage']),
  customer: new Set<WorkspaceCapability>(['billing.manage', 'loads.create', 'loads.publish', 'loads.view.own', 'quotes.receive', 'quotes.compare', 'quotes.award', 'jobs.view', 'jobs.track', 'jobs.review_pod', 'invoices.customer.manage', 'settings.manage']),
  fleet_manager: new Set<WorkspaceCapability>(['jobs.view', 'jobs.allocate', 'jobs.dispatch', 'jobs.track', 'drivers.manage', 'vehicles.manage', 'fleet.positions.view', 'fleet.maintenance.manage', 'documents.company.manage', 'invoices.carrier.manage', 'incidents.manage']),
  dispatcher: new Set<WorkspaceCapability>(['loads.create', 'loads.publish', 'jobs.view', 'jobs.allocate', 'jobs.dispatch', 'jobs.track', 'jobs.review_pod', 'drivers.manage', 'vehicles.manage', 'fleet.positions.view', 'incidents.manage', 'settings.manage']),
  driver: new Set<WorkspaceCapability>(DRIVER_WORKSPACE_CAPABILITIES),
  owner_driver: new Set<WorkspaceCapability>([...DRIVER_WORKSPACE_CAPABILITIES, 'drivers.manage', 'company.members.manage', 'invoices.carrier.manage', 'billing.manage']),
  finance: new Set<WorkspaceCapability>(['jobs.view', 'invoices.customer.manage', 'invoices.carrier.manage', 'payments.manage', 'margins.view', 'settings.manage']),
  compliance: new Set<WorkspaceCapability>(['drivers.manage', 'vehicles.manage', 'documents.company.manage', 'documents.verify', 'incidents.manage', 'settings.manage']),
  viewer: new Set<WorkspaceCapability>(['jobs.view']),
};

export const hasWorkspaceCapability = (role: WorkspaceRole, capability: WorkspaceCapability) => CAPABILITIES[role].has(capability);

export const getWorkspaceCapabilities = (role: WorkspaceRole): readonly WorkspaceCapability[] =>
  [...CAPABILITIES[role]].sort();

const carrierNav: WorkspaceNavGroup[] = [
  { id: 'carrier-dashboard', label: 'Dashboard', items: [{ id: 'dashboard', label: 'Dashboard', href: '/admin', icon: '⌂' }] },
  { id: 'carrier-marketplace', label: 'Marketplace', items: [{ id: 'marketplace', label: 'Marketplace', href: '/admin/marketplace', icon: '▦', capability: 'loads.view.marketplace' }] },
  { id: 'carrier-directory', label: 'Directory', items: [{ id: 'directory', label: 'Directory', href: '/admin/marketplace/directory', icon: '⊕', capability: 'loads.view.marketplace' }] },
  { id: 'carrier-live', label: 'Live Availability', items: [{ id: 'live-availability', label: 'Live Availability', href: '/admin/live-availability', icon: '◉', capability: 'fleet.positions.view' }] },
  { id: 'carrier-freight-vision', label: 'Freight Vision', items: [{ id: 'freight-vision', label: 'Freight Vision', href: '/admin/freight-vision', icon: '◎', capability: 'jobs.track' }] },
  { id: 'carrier-quotes', label: 'Quotes', items: [{ id: 'quotes', label: 'Quotes', href: '/admin/exchange-quotes', icon: '◫', capability: 'quotes.submit' }] },
  { id: 'carrier-won-work', label: 'Won Work', items: [{ id: 'won-work', label: 'Won Work', href: '/admin/won-work', icon: '✓', capability: 'jobs.view' }] },
  { id: 'carrier-jobs', label: 'Jobs', items: [
    { id: 'jobs', label: 'Jobs', href: '/admin/jobs', icon: '▣', capability: 'jobs.view' },
    { id: 'bulk-import', label: 'Bulk Import', href: '/admin/bulk-import', icon: '⇩', capability: 'loads.create' },
  ] },
  { id: 'carrier-pod', label: 'POD', items: [{ id: 'pod', label: 'POD Queue', href: '/admin/pod', icon: '▤', capability: 'jobs.review_pod' }] },
  { id: 'carrier-allocation', label: 'Allocation', items: [{ id: 'allocation', label: 'Allocation', href: '/admin/fleet/assignments', icon: '⇄', capability: 'jobs.allocate' }] },
  { id: 'carrier-resources', label: 'Drivers & Vehicles', items: [
    { id: 'resources', label: 'Drivers & Vehicles', href: '/admin/fleet/resources', icon: '◎', capability: 'fleet.positions.view' },
    { id: 'drivers', label: 'Drivers', href: '/admin/drivers', icon: '◉', capability: 'drivers.manage' },
    { id: 'vehicles', label: 'Vehicles', href: '/admin/vehicles', icon: '▰', capability: 'vehicles.manage' },
    { id: 'vehicle-tracking', label: 'Vehicle Tracking', href: '/admin/fleet/positions', icon: '⌖', capability: 'fleet.positions.view' },
  ] },
  { id: 'carrier-fleet', label: 'Fleet', items: [{ id: 'fleet', label: 'Fleet', href: '/admin/fleet', icon: '◎', capability: 'fleet.positions.view' }, { id: 'fleet-managers', label: 'Fleet Managers', href: '/admin/fleet/managers', icon: '◉', capability: 'company.members.manage' }] },
  { id: 'carrier-team', label: 'Team & Roles', items: [{ id: 'team-roles', label: 'Team & Roles', href: '/admin/team', icon: 'TEAM', capability: 'company.members.manage' }, { id: 'dispatchers', label: 'Dispatchers', href: '/admin/dispatchers', icon: 'OPS', capability: 'company.members.manage' }] },
  { id: 'carrier-returns', label: 'Returns', items: [{ id: 'returns', label: 'Returns', href: '/admin/fleet/returns', icon: '↩' }] },
  { id: 'carrier-diary', label: 'Diary', items: [{ id: 'diary', label: 'Diary', href: '/admin/diary', icon: '□', capability: 'jobs.view' }] },
  { id: 'carrier-messages', label: 'Messages', items: [{ id: 'messages', label: 'Messages', href: '/admin/messages', icon: '◫' }] },
  { id: 'carrier-event-log', label: 'Event Log', items: [{ id: 'event-log', label: 'Event Log', href: '/admin/event-log', icon: '≡', capability: 'jobs.view' }] },
  { id: 'carrier-finance', label: 'Finance', items: [
    { id: 'finance', label: 'Finance', href: '/admin/invoices', icon: '£', capability: 'invoices.carrier.manage' },
    { id: 'statements', label: 'Statements', href: '/admin/finance/statements', icon: '▤', capability: 'invoices.carrier.manage' },
    { id: 'reports-data', label: 'Reports & Data', href: '/admin/finance/reports', icon: '▤', capability: 'invoices.carrier.manage' },
  ] },
  { id: 'carrier-compliance', label: 'Compliance', items: [{ id: 'compliance', label: 'Compliance', href: '/admin/documents', icon: '✓', capability: 'documents.company.manage' }] },
  { id: 'carrier-billing', label: 'Membership & Billing', items: [{ id: 'billing', label: 'Membership & Billing', href: '/admin/settings/billing', icon: '£', capability: 'billing.manage' }] },
  { id: 'carrier-account', label: 'Account', items: [{ id: 'account', label: 'Account', href: '/admin/settings', icon: '⚙', capability: 'settings.manage' }] },
];

export const WORKSPACE_DEFINITIONS: Record<WorkspaceRole, WorkspaceDefinition> = {
  platform_owner: { role: 'platform_owner', label: 'Platform Owner', subtitle: 'Global platform administration', homeHref: '/super-admin', nav: [] },
  company_owner: { role: 'company_owner', label: 'Company Owner', subtitle: 'Company commercial and operational control', homeHref: '/admin', primaryAction: { label: 'Find Loads', href: '/admin/marketplace', capability: 'loads.view.marketplace' }, nav: carrierNav },
  company_admin: { role: 'company_admin', label: 'Company Admin', subtitle: 'Company operations and administration', homeHref: '/admin', primaryAction: { label: 'Find Loads', href: '/admin/marketplace', capability: 'loads.view.marketplace' }, nav: carrierNav },
  carrier_admin: { role: 'carrier_admin', label: 'Carrier Workspace', subtitle: 'Commercial, operations and fleet', homeHref: '/admin', primaryAction: { label: 'Find Loads', href: '/admin/marketplace', capability: 'loads.view.marketplace' }, nav: carrierNav },
  broker: {
    role: 'broker', label: 'Broker Workspace', subtitle: 'Customer loads, carrier sourcing and margin control', homeHref: '/broker', primaryAction: { label: 'Post Load', href: '/broker/post-load', capability: 'loads.create' },
    nav: [
      { id: 'broker-dashboard', label: 'Dashboard', items: [{ id: 'dashboard', label: 'Dashboard', href: '/broker', icon: '⌂' }] },
      { id: 'broker-enquiries', label: 'Enquiries', items: [{ id: 'enquiries', label: 'Enquiries', href: '/broker/enquiries', icon: '◫', capability: 'loads.view.own' }] },
      { id: 'broker-loads', label: 'Loads', items: [
        { id: 'loads', label: 'Loads', href: '/broker/loads', icon: '▦', capability: 'loads.view.own' },
        { id: 'bulk-import', label: 'Bulk Import', href: '/broker/bulk-import', icon: '⇩', capability: 'loads.create' },
      ] },
      { id: 'broker-quotes', label: 'Quotes', items: [{ id: 'quotes', label: 'Quotes', href: '/broker/bids', icon: '◫', capability: 'quotes.receive' }] },
      { id: 'broker-jobs', label: 'Jobs', items: [{ id: 'jobs', label: 'Jobs', href: '/broker/jobs', icon: '▣', capability: 'jobs.track' }] },
      { id: 'broker-pod', label: 'POD', items: [{ id: 'pod', label: 'POD Review', href: '/broker/pod-review', icon: '▤', capability: 'jobs.review_pod' }] },
      { id: 'broker-directory', label: 'Directory', items: [{ id: 'directory', label: 'Directory', href: '/broker/carrier-network', icon: '⊕', capability: 'settings.manage' }] },
      { id: 'broker-customers', label: 'Customers', items: [{ id: 'customers', label: 'Customers', href: '/broker/customers', icon: '◌' }] },
      { id: 'broker-diary', label: 'Diary', items: [{ id: 'diary', label: 'Diary', href: '/broker/diary', icon: '□', capability: 'jobs.view' }] },
      { id: 'broker-messages', label: 'Messages', items: [{ id: 'messages', label: 'Messages', href: '/broker/messages', icon: '◫' }] },
      { id: 'broker-event-log', label: 'Event Log', items: [{ id: 'event-log', label: 'Event Log', href: '/broker/event-log', icon: '≡', capability: 'jobs.view' }] },
      { id: 'broker-disputes', label: 'Disputes', items: [{ id: 'disputes', label: 'Disputes', href: '/broker/disputes', icon: '!', capability: 'incidents.manage' }] },
      { id: 'broker-finance', label: 'Finance', items: [{ id: 'finance', label: 'Finance', href: '/broker/finance', icon: '£', capability: 'invoices.customer.manage' }] },
      { id: 'broker-reports', label: 'Reports', items: [{ id: 'reports', label: 'Reports', href: '/broker/reports', icon: '□', capability: 'margins.view' }] },
      { id: 'broker-billing', label: 'Membership & Billing', items: [{ id: 'billing', label: 'Membership & Billing', href: '/broker/settings/billing', icon: '£', capability: 'billing.manage' }] },
      { id: 'broker-account', label: 'Account', items: [{ id: 'account', label: 'Account', href: '/broker/account', icon: '⚙', capability: 'settings.manage' }] },
    ],
  },
  customer: {
    role: 'customer', label: 'Customer Workspace', subtitle: 'Post, award and track your transport', homeHref: '/customer', primaryAction: { label: 'Post Load', href: '/customer/post-load', capability: 'loads.create' },
    nav: [
      { id: 'customer-dashboard', label: 'Dashboard', items: [{ id: 'dashboard', label: 'Dashboard', href: '/customer', icon: '⌂' }] },
      { id: 'customer-loads', label: 'Loads', items: [
        { id: 'loads', label: 'Loads', href: '/customer/loads', icon: '▦', capability: 'loads.view.own' },
        { id: 'bulk-import', label: 'Bulk Import', href: '/customer/bulk-import', icon: '⇩', capability: 'loads.create' },
      ] },
      { id: 'customer-quotes', label: 'Quotes', items: [{ id: 'quotes', label: 'Quotes', href: '/customer/quotes', icon: '◫', capability: 'quotes.receive' }] },
      { id: 'customer-bookings', label: 'Bookings', items: [{ id: 'bookings', label: 'Bookings', href: '/customer/bookings', icon: '▣', capability: 'jobs.view' }] },
      { id: 'customer-tracking', label: 'Tracking', items: [{ id: 'tracking', label: 'Tracking', href: '/customer/tracking', icon: '⌖', capability: 'jobs.track' }] },
      { id: 'customer-diary', label: 'Diary', items: [{ id: 'diary', label: 'Diary', href: '/customer/diary', icon: '□', capability: 'jobs.view' }] },
      { id: 'customer-documents', label: 'Documents', items: [{ id: 'documents', label: 'Documents', href: '/customer/documents', icon: '▤', capability: 'jobs.view' }] },
      { id: 'customer-invoices', label: 'Invoices', items: [{ id: 'invoices', label: 'Invoices', href: '/customer/invoices', icon: '£', capability: 'invoices.customer.manage' }] },
      { id: 'customer-notifications', label: 'Notifications', items: [{ id: 'notifications', label: 'Notifications', href: '/customer/notifications', icon: '◫' }] },
      { id: 'customer-messages', label: 'Messages', items: [{ id: 'messages', label: 'Messages', href: '/customer/messages', icon: '◫' }] },
      { id: 'customer-event-log', label: 'Event Log', items: [{ id: 'event-log', label: 'Event Log', href: '/customer/event-log', icon: '≡', capability: 'jobs.view' }] },
      { id: 'customer-directory', label: 'Directory', items: [{ id: 'directory', label: 'Directory', href: '/customer/network', icon: '◌' }] },
      { id: 'customer-disputes', label: 'Disputes', items: [{ id: 'disputes', label: 'Disputes', href: '/customer/disputes', icon: '!', capability: 'jobs.view' }] },
      { id: 'customer-billing', label: 'Membership & Billing', items: [{ id: 'billing', label: 'Membership & Billing', href: '/customer/settings/billing', icon: '£', capability: 'billing.manage' }] },
      { id: 'customer-account', label: 'Account', items: [{ id: 'account', label: 'Account', href: '/customer/account', icon: '⚙', capability: 'settings.manage' }] },
    ],
  },
  fleet_manager: {
    role: 'fleet_manager', label: 'Fleet Workspace', subtitle: 'Capacity, assignments, compliance and live operations', homeHref: '/admin/fleet',
    nav: [
      { id: 'fleet-dashboard', label: 'Dashboard', items: [{ id: 'dashboard', label: 'Dashboard', href: '/admin/fleet', icon: '⌂' }] },
      { id: 'fleet-jobs', label: 'Jobs', items: [{ id: 'jobs', label: 'Jobs', href: '/admin/fleet/jobs', icon: '▣', capability: 'jobs.view' }] },
      { id: 'fleet-assignments', label: 'Assignments', items: [{ id: 'assignments', label: 'Assignments', href: '/admin/fleet/assignments', icon: '⇄', capability: 'jobs.allocate' }] },
      { id: 'fleet-drivers', label: 'Drivers', items: [{ id: 'drivers', label: 'Drivers', href: '/admin/fleet/drivers', icon: '◉', capability: 'drivers.manage' }] },
      { id: 'fleet-vehicles', label: 'Vehicles', items: [{ id: 'vehicles', label: 'Vehicles', href: '/admin/fleet/vehicles', icon: '▰', capability: 'vehicles.manage' }] },
      { id: 'fleet-availability', label: 'Availability', items: [{ id: 'availability', label: 'Availability', href: '/admin/fleet/availability', icon: '◷', capability: 'drivers.manage' }] },
      { id: 'fleet-future', label: 'Future Availability', items: [{ id: 'future-availability', label: 'Future Availability', href: '/admin/fleet/future-availability', icon: '↗', capability: 'drivers.manage' }] },
      { id: 'fleet-positions', label: 'Live Positions', items: [{ id: 'positions', label: 'Live Positions', href: '/admin/fleet/positions', icon: '⌖', capability: 'fleet.positions.view' }] },
      { id: 'fleet-returns', label: 'Returns', items: [{ id: 'returns', label: 'Returns', href: '/admin/fleet/returns', icon: '↩' }] },
      { id: 'fleet-maintenance', label: 'Maintenance', items: [{ id: 'maintenance', label: 'Maintenance', href: '/admin/fleet/maintenance', icon: '⚒', capability: 'fleet.maintenance.manage' }] },
      { id: 'fleet-exceptions', label: 'Exceptions', items: [{ id: 'exceptions', label: 'Exceptions', href: '/admin/incidents', icon: '!', capability: 'incidents.manage' }] },
      { id: 'fleet-diary', label: 'Diary', items: [{ id: 'diary', label: 'Diary', href: '/admin/diary', icon: '□', capability: 'jobs.view' }] },
      { id: 'fleet-freight-vision', label: 'Freight Vision', items: [{ id: 'freight-vision', label: 'Freight Vision', href: '/admin/freight-vision', icon: '◎', capability: 'jobs.track' }] },
      { id: 'fleet-messages', label: 'Messages', items: [{ id: 'messages', label: 'Messages', href: '/admin/messages', icon: '◫' }] },
      { id: 'fleet-event-log', label: 'Event Log', items: [{ id: 'event-log', label: 'Event Log', href: '/admin/event-log', icon: '≡', capability: 'jobs.view' }] },
      { id: 'fleet-finance', label: 'Finance', items: [{ id: 'finance', label: 'Finance', href: '/admin/invoices', icon: '£', capability: 'invoices.carrier.manage' }] },
      { id: 'fleet-compliance', label: 'Compliance', items: [{ id: 'compliance', label: 'Compliance', href: '/admin/fleet/compliance', icon: '✓', capability: 'documents.company.manage' }] },
      { id: 'fleet-settings', label: 'Settings', items: [{ id: 'settings', label: 'Settings', href: '/admin/settings', icon: '⚙', capability: 'settings.manage' }] },
    ],
  },
  dispatcher: {
    role: 'dispatcher', label: 'Operations Workspace', subtitle: 'Allocate, monitor and recover daily jobs', homeHref: '/admin',
    nav: [
      { id: 'home', label: 'Operations', items: [{ id: 'dashboard', label: 'Dispatcher Dashboard', href: '/admin', icon: '⌂' }] },
      { id: 'work', label: 'Daily Work', items: [
        { id: 'diary', label: 'Diary', href: '/admin/diary', icon: '□' },
        { id: 'bulk-import', label: 'Bulk Import', href: '/admin/bulk-import', icon: '⇩', capability: 'loads.create' },
        { id: 'unallocated', label: 'Unallocated Jobs', href: '/admin/fleet/assignments', icon: '⇄' },
        { id: 'active-jobs', label: 'Active Jobs', href: '/admin/fleet/active-jobs', icon: '▣' },
        { id: 'collections', label: 'Collections', href: '/admin/collections', icon: '↑' },
        { id: 'deliveries', label: 'Deliveries', href: '/admin/deliveries', icon: '↓' },
        { id: 'exceptions', label: 'Exceptions', href: '/admin/incidents', icon: '!' },
        { id: 'pod', label: 'POD Queue', href: '/admin/pod', icon: '▤' },
      ] },
      { id: 'resources', label: 'Resources', items: [
        { id: 'drivers', label: 'Drivers', href: '/admin/drivers', icon: '◉' },
        { id: 'vehicles', label: 'Vehicles', href: '/admin/vehicles', icon: '▰' },
        { id: 'positions', label: 'Live Positions', href: '/admin/fleet/positions', icon: '⌖' },
      ] },
      { id: 'dispatcher-settings', label: 'Settings', items: [{ id: 'settings', label: 'Settings', href: '/admin/settings', icon: '⚙', capability: 'settings.manage' }] },
    ],
  },
  driver: {
    role: 'driver', label: 'Driver Workspace', subtitle: 'Assigned transport execution and driver readiness', homeHref: '/driver', nav: DRIVER_EXECUTION_NAV,
  },
  owner_driver: {
    role: 'owner_driver', label: 'Owner Driver Workspace', subtitle: 'Transport execution and commercial driver tools', homeHref: '/driver', primaryAction: { label: 'Find Loads', href: '/driver/loads', capability: 'loads.view.marketplace' }, nav: OWNER_DRIVER_NAV,
  },
  finance: {
    role: 'finance', label: 'Finance Workspace', subtitle: 'Invoices, payments, balances and reporting', homeHref: '/admin/invoices',
    nav: [
      { id: 'finance', label: 'Finance', items: [
        { id: 'dashboard', label: 'Finance Dashboard', href: '/admin/invoices', icon: '⌂' },
        { id: 'customer-invoices', label: 'Customer Invoices', href: '/admin/finance/customer-invoices', icon: '£' },
        { id: 'carrier-invoices', label: 'Carrier Invoices', href: '/admin/finance/carrier-invoices', icon: '£' },
        { id: 'payments', label: 'Payments', href: '/admin/finance/payments', icon: '✓' },
        { id: 'balances', label: 'Outstanding Balances', href: '/admin/finance/balances', icon: '!' },
        { id: 'statements', label: 'Statements', href: '/admin/finance/statements', icon: '▤' },
        { id: 'reports', label: 'Reports & Data', href: '/admin/finance/reports', icon: '▤' },
      ] },
      { id: 'finance-settings', label: 'Settings', items: [{ id: 'settings', label: 'Settings', href: '/admin/settings', icon: '⚙', capability: 'settings.manage' }] },
    ],
  },
  compliance: {
    role: 'compliance', label: 'Compliance Workspace', subtitle: 'Verification, expiry and operational readiness', homeHref: '/admin/documents',
    nav: [
      { id: 'compliance', label: 'Compliance', items: [
        { id: 'dashboard', label: 'Compliance Dashboard', href: '/admin/documents', icon: '⌂' },
        { id: 'driver-docs', label: 'Driver Documents', href: '/admin/documents?type=driver', icon: '▤' },
        { id: 'vehicle-docs', label: 'Vehicle Documents', href: '/admin/documents?type=vehicle', icon: '▤' },
        { id: 'company-docs', label: 'Company Documents', href: '/admin/documents/company', icon: '▤' },
        { id: 'verification', label: 'Verification Queue', href: '/admin/documents?view=pending', icon: '✓' },
        { id: 'expiry', label: 'Expiry Calendar', href: '/admin/documents/expiry', icon: '◷' },
        { id: 'incidents', label: 'Incidents', href: '/admin/incidents', icon: '!' },
      ] },
      { id: 'compliance-settings', label: 'Settings', items: [{ id: 'settings', label: 'Settings', href: '/admin/settings', icon: '⚙', capability: 'settings.manage' }] },
    ],
  },
  viewer: {
    role: 'viewer', label: 'Read-only Workspace', subtitle: 'Approved operational visibility', homeHref: '/admin',
    nav: [{ id: 'view', label: 'Read Only', items: [{ id: 'dashboard', label: 'Dashboard', href: '/admin', icon: '⌂' }, { id: 'jobs', label: 'Jobs', href: '/admin/jobs', icon: '▣' }] }],
  },
};

export const getWorkspaceDefinition = (role: WorkspaceRole): WorkspaceDefinition => WORKSPACE_DEFINITIONS[role];

export const getVisibleWorkspaceNav = (role: WorkspaceRole): WorkspaceNavGroup[] =>
  WORKSPACE_DEFINITIONS[role].nav
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.capability || hasWorkspaceCapability(role, item.capability)) }))
    .filter((group) => group.items.length > 0);

export const resolveWorkspaceSurfaceRole = (pathname: string, role: WorkspaceRole): WorkspaceRole => {
  const cleanPath = normalizePathname(pathname);
  if (cleanPath === '/driver' || cleanPath.startsWith('/driver/')) {
    if (role === 'owner_driver') return 'owner_driver';
    return 'driver';
  }
  return role;
};

export const getWorkspaceHomeRoute = (user: WorkspaceUserLike | null | undefined): string =>
  WORKSPACE_DEFINITIONS[resolveWorkspaceRole(user)].homeHref;
