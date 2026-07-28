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
    user.ownerDriverWorkspace === true ||
    ['owner_driver', 'owner_operator', 'self_employed', 'self_employed_driver', 'sole_trader'].includes(rawRole)
  ) {
    return 'owner_driver';
  }

  if (appRole === 'driver' || rawRole === 'driver' || rawRole === 'company_driver' || rawRole === 'solo_driver') return 'driver';

  if (rawRole === 'fleet_operator' || rawRole === 'fleet_manager' || rawRole === 'fleet_admin') return 'fleet_manager';
  if (rawRole === 'dispatcher' || rawRole === 'operations_controller' || membershipRole === 'dispatcher') return 'dispatcher';
  if (rawRole === 'finance' || rawRole === 'accounting' || rawRole === 'accountant' || membershipRole === 'finance') return 'finance';
  if (rawRole === 'compliance' || rawRole === 'compliance_manager' || membershipRole === 'compliance') return 'compliance';
  if (rawRole === 'viewer' || membershipRole === 'viewer') return 'viewer';

  if (membershipRole === 'owner') return 'company_owner';
  if (membershipRole === 'admin' || appRole === 'company_admin') return rawRole === 'carrier' ? 'carrier_admin' : 'company_admin';
  if (appRole === 'company_staff' || membershipRole === 'member') return 'carrier_admin';

  return 'viewer';
};

const ALL_COMPANY_MANAGEMENT: WorkspaceCapability[] = [
  'company.manage',
  'company.members.manage',
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

const CAPABILITIES: Record<WorkspaceRole, ReadonlySet<WorkspaceCapability>> = {
  platform_owner: new Set<WorkspaceCapability>(['platform.manage', ...ALL_COMPANY_MANAGEMENT, ...CARRIER_COMMERCIAL, 'loads.create', 'loads.publish', 'loads.view.own', 'quotes.receive', 'quotes.compare', 'quotes.award', 'jobs.execute', 'documents.own.manage', 'documents.verify', 'invoices.customer.manage', 'payments.manage', 'margins.view']),
  company_owner: new Set<WorkspaceCapability>([...ALL_COMPANY_MANAGEMENT, ...CARRIER_COMMERCIAL, 'loads.create', 'loads.publish', 'loads.view.own', 'quotes.receive', 'quotes.compare', 'quotes.award', 'invoices.customer.manage', 'payments.manage', 'margins.view']),
  company_admin: new Set<WorkspaceCapability>([...ALL_COMPANY_MANAGEMENT, ...CARRIER_COMMERCIAL, 'loads.create', 'loads.publish', 'loads.view.own', 'quotes.receive', 'quotes.compare', 'quotes.award', 'invoices.customer.manage', 'payments.manage', 'margins.view']),
  carrier_admin: new Set<WorkspaceCapability>(CARRIER_COMMERCIAL),
  broker: new Set<WorkspaceCapability>(['company.manage', 'loads.create', 'loads.publish', 'loads.view.own', 'quotes.receive', 'quotes.compare', 'quotes.award', 'jobs.view', 'jobs.track', 'jobs.review_pod', 'documents.company.manage', 'invoices.customer.manage', 'invoices.carrier.manage', 'margins.view', 'incidents.manage', 'settings.manage']),
  customer: new Set<WorkspaceCapability>(['loads.create', 'loads.publish', 'loads.view.own', 'quotes.receive', 'quotes.compare', 'quotes.award', 'jobs.view', 'jobs.track', 'jobs.review_pod', 'invoices.customer.manage', 'settings.manage']),
  fleet_manager: new Set<WorkspaceCapability>(['jobs.view', 'jobs.allocate', 'jobs.dispatch', 'jobs.track', 'drivers.manage', 'vehicles.manage', 'fleet.positions.view', 'fleet.maintenance.manage', 'documents.company.manage', 'incidents.manage', 'settings.manage']),
  dispatcher: new Set<WorkspaceCapability>(['jobs.view', 'jobs.allocate', 'jobs.dispatch', 'jobs.track', 'jobs.review_pod', 'drivers.manage', 'vehicles.manage', 'fleet.positions.view', 'incidents.manage']),
  driver: new Set<WorkspaceCapability>(['jobs.view', 'jobs.execute', 'jobs.track', 'documents.own.manage']),
  owner_driver: new Set<WorkspaceCapability>(['loads.view.marketplace', 'quotes.submit', 'jobs.view', 'jobs.execute', 'jobs.track', 'jobs.review_pod', 'vehicles.manage', 'documents.own.manage', 'invoices.carrier.manage']),
  finance: new Set<WorkspaceCapability>(['jobs.view', 'invoices.customer.manage', 'invoices.carrier.manage', 'payments.manage', 'margins.view']),
  compliance: new Set<WorkspaceCapability>(['drivers.manage', 'vehicles.manage', 'documents.company.manage', 'documents.verify', 'incidents.manage']),
  viewer: new Set<WorkspaceCapability>(['jobs.view']),
};

export const hasWorkspaceCapability = (role: WorkspaceRole, capability: WorkspaceCapability) => CAPABILITIES[role].has(capability);

const companyNav: WorkspaceNavGroup[] = [
  { id: 'home', label: 'Workspace', items: [{ id: 'dashboard', label: 'Customer Dashboard', href: '/admin', icon: '⌂' }] },
  { id: 'commercial', label: 'Commercial', items: [
    { id: 'marketplace', label: 'Marketplace', href: '/admin/marketplace', icon: '▦', capability: 'loads.view.marketplace' },
    { id: 'commercial', label: 'Quotes & Awards', href: '/admin/commercial', icon: '◫', capability: 'quotes.submit' },
    { id: 'broker-invitations', label: 'Broker Invitations', href: '/admin/broker-invitations', icon: '✉' },
  ] },
  { id: 'operations', label: 'Operations', items: [
    { id: 'jobs', label: 'Jobs', href: '/admin/jobs', icon: '▣', capability: 'jobs.view' },
    { id: 'diary', label: 'Diary', href: '/admin/diary', icon: '□', capability: 'jobs.view' },
    { id: 'operations', label: 'Live Operations', href: '/admin/operations-centre', icon: 'OC', capability: 'jobs.dispatch' },
    { id: 'disputes', label: 'Disputes', href: '/admin/disputes', icon: '!', capability: 'incidents.manage' },
  ] },
  { id: 'fleet', label: 'Fleet', items: [
    { id: 'drivers-vehicles', label: 'Drivers & Vehicles', href: '/admin/drivers-vehicles', icon: '◉', capability: 'drivers.manage' },
    { id: 'availability', label: 'Availability', href: '/admin/driver-availability', icon: '◷', capability: 'drivers.manage' },
    { id: 'positions', label: 'Live Positions', href: '/admin/fleet/positions', icon: '⌖', capability: 'fleet.positions.view' },
    { id: 'maintenance', label: 'Maintenance', href: '/admin/fleet/maintenance', icon: '⚙', capability: 'fleet.maintenance.manage' },
  ] },
  { id: 'compliance', label: 'Compliance', items: [
    { id: 'documents', label: 'Documents', href: '/admin/documents', icon: '▤', capability: 'documents.company.manage' },
    { id: 'expiry', label: 'Document Expiry', href: '/admin/documents/expiry', icon: '◷', capability: 'documents.company.manage' },
    { id: 'incidents', label: 'Incidents', href: '/admin/incidents', icon: '△', capability: 'incidents.manage' },
  ] },
  { id: 'finance', label: 'Finance', items: [{ id: 'invoices', label: 'Invoices', href: '/admin/invoices', icon: '£', capability: 'invoices.carrier.manage' }] },
  { id: 'administration', label: 'Administration', items: [
    { id: 'members', label: 'Team', href: '/admin/dispatchers', icon: '◌', capability: 'company.members.manage' },
    { id: 'settings', label: 'Settings', href: '/admin/settings', icon: '⚙', capability: 'settings.manage' },
  ] },
];

export const WORKSPACE_DEFINITIONS: Record<WorkspaceRole, WorkspaceDefinition> = {
  platform_owner: { role: 'platform_owner', label: 'Platform Owner', subtitle: 'Global platform administration', homeHref: '/super-admin', nav: [] },
  company_owner: { role: 'company_owner', label: 'Company Owner', subtitle: 'Customer Dashboard — commercial and operational control', homeHref: '/admin', primaryAction: { label: 'Find Loads', href: '/admin/marketplace', capability: 'loads.view.marketplace' }, nav: companyNav },
  company_admin: { role: 'company_admin', label: 'Company Admin', subtitle: 'Company operations and administration', homeHref: '/admin', primaryAction: { label: 'Find Loads', href: '/admin/marketplace', capability: 'loads.view.marketplace' }, nav: companyNav },
  carrier_admin: { role: 'carrier_admin', label: 'Carrier Workspace', subtitle: 'Commercial, operations and fleet', homeHref: '/admin', primaryAction: { label: 'Find Loads', href: '/admin/marketplace', capability: 'loads.view.marketplace' }, nav: companyNav },
  broker: {
    role: 'broker', label: 'Broker Workspace', subtitle: 'Customer loads, carrier sourcing and margin control', homeHref: '/broker', primaryAction: { label: 'Post Load', href: '/broker/post-load', capability: 'loads.create' },
    nav: [
      { id: 'home', label: 'Broker', items: [{ id: 'dashboard', label: 'Broker Dashboard', href: '/broker', icon: '⌂' }] },
      { id: 'customers', label: 'Customers & Loads', items: [
        { id: 'customers', label: 'Customers', href: '/broker/customers', icon: '◌' },
        { id: 'loads', label: 'Customer Loads', href: '/broker/loads', icon: '▦' },
        { id: 'post-load', label: 'Post Load', href: '/broker/post-load', icon: '+', capability: 'loads.create' },
      ] },
      { id: 'commercial', label: 'Commercial', items: [
        { id: 'carrier-quotes', label: 'Carrier Quotes', href: '/broker/bids', icon: '◫', capability: 'quotes.receive' },
        { id: 'compare', label: 'Compare Quotes', href: '/broker/compare-quotes', icon: '⇄', capability: 'quotes.compare' },
        { id: 'awards', label: 'Awards', href: '/broker/awards', icon: '✓', capability: 'quotes.award' },
        { id: 'margins', label: 'Margin / Profit', href: '/broker/margins', icon: '%', capability: 'margins.view' },
      ] },
      { id: 'operations', label: 'Operations', items: [
        { id: 'jobs', label: 'Active Jobs', href: '/broker/jobs', icon: '▣', capability: 'jobs.track' },
        { id: 'pod', label: 'POD Review', href: '/broker/pod-review', icon: '▤', capability: 'jobs.review_pod' },
        { id: 'disputes', label: 'Disputes', href: '/broker/disputes', icon: '!', capability: 'incidents.manage' },
      ] },
      { id: 'finance', label: 'Finance', items: [
        { id: 'customer-invoices', label: 'Customer Invoices', href: '/broker/customer-invoices', icon: '£', capability: 'invoices.customer.manage' },
        { id: 'carrier-costs', label: 'Carrier Costs', href: '/broker/carrier-costs', icon: '£', capability: 'invoices.carrier.manage' },
      ] },
      { id: 'settings', label: 'Administration', items: [
        { id: 'settings', label: 'Settings', href: '/broker/settings', icon: '⚙', capability: 'settings.manage' },
        { id: 'team', label: 'Team', href: '/broker/team', icon: '◎', capability: 'settings.manage' },
        { id: 'carrier-network', label: 'Carrier Network', href: '/broker/carrier-network', icon: '⊕', capability: 'settings.manage' },
      ] },
    ],
  },
  customer: {
    role: 'customer', label: 'Customer Workspace', subtitle: 'Post, award and track your transport', homeHref: '/customer', primaryAction: { label: 'Post Load', href: '/customer/post-load', capability: 'loads.create' },
    nav: [
      { id: 'home', label: 'Customer', items: [{ id: 'dashboard', label: 'Customer Dashboard', href: '/customer', icon: '⌂' }] },
      { id: 'loads', label: 'Loads', items: [
        { id: 'post-load', label: 'Post Load', href: '/customer/post-load', icon: '+', capability: 'loads.create' },
        { id: 'my-loads', label: 'My Loads', href: '/customer/loads', icon: '▦', capability: 'loads.view.own' },
        { id: 'quotes', label: 'Quotes', href: '/customer/quotes', icon: '◫', capability: 'quotes.receive' },
        { id: 'awards', label: 'Awards', href: '/customer/awards', icon: '✓', capability: 'quotes.award' },
      ] },
      { id: 'delivery', label: 'Delivery', items: [
        { id: 'deliveries', label: 'Deliveries', href: '/customer/deliveries', icon: '▣', capability: 'jobs.track' },
        { id: 'documents', label: 'POD & Documents', href: '/customer/documents', icon: '▤', capability: 'jobs.review_pod' },
        { id: 'updates', label: 'Updates', href: '/customer/updates', icon: '◉' },
      ] },
      { id: 'finance', label: 'Finance', items: [{ id: 'invoices', label: 'Invoices', href: '/customer/invoices', icon: '£', capability: 'invoices.customer.manage' }] },
      { id: 'settings', label: 'Administration', items: [
        { id: 'team', label: 'Team', href: '/customer/team', icon: '◌' },
        { id: 'settings', label: 'Settings', href: '/customer/settings', icon: '⚙', capability: 'settings.manage' },
      ] },
    ],
  },
  fleet_manager: {
    role: 'fleet_manager', label: 'Fleet Workspace', subtitle: 'Capacity, assignments, compliance and live operations', homeHref: '/admin/fleet',
    nav: [
      { id: 'home', label: 'Fleet', items: [{ id: 'dashboard', label: 'Fleet Dashboard', href: '/admin/fleet', icon: '⌂' }] },
      { id: 'resources', label: 'People & Vehicles', items: [
        { id: 'drivers', label: 'Drivers', href: '/admin/drivers', icon: '◉', capability: 'drivers.manage' },
        { id: 'availability', label: 'Driver Availability', href: '/admin/driver-availability', icon: '◷', capability: 'drivers.manage' },
        { id: 'vehicles', label: 'Vehicles', href: '/admin/vehicles', icon: '▰', capability: 'vehicles.manage' },
        { id: 'positions', label: 'Live Positions', href: '/admin/fleet/positions', icon: '⌖', capability: 'fleet.positions.view' },
      ] },
      { id: 'operations', label: 'Operations', items: [
        { id: 'assignments', label: 'Assignments', href: '/admin/fleet/assignments', icon: '⇄', capability: 'jobs.allocate' },
        { id: 'active-jobs', label: 'Active Jobs', href: '/admin/fleet/active-jobs', icon: '▣', capability: 'jobs.track' },
        { id: 'future', label: 'Future Availability', href: '/admin/fleet/future-availability', icon: '◷', capability: 'drivers.manage' },
      ] },
      { id: 'readiness', label: 'Readiness', items: [
        { id: 'maintenance', label: 'Maintenance', href: '/admin/fleet/maintenance', icon: '⚙', capability: 'fleet.maintenance.manage' },
        { id: 'compliance', label: 'Compliance', href: '/admin/documents', icon: '✓', capability: 'documents.company.manage' },
        { id: 'expiry', label: 'Document Expiry', href: '/admin/documents/expiry', icon: '◷', capability: 'documents.company.manage' },
        { id: 'incidents', label: 'Incidents', href: '/admin/incidents', icon: '!', capability: 'incidents.manage' },
      ] },
      { id: 'settings', label: 'Administration', items: [{ id: 'settings', label: 'Settings', href: '/admin/settings', icon: '⚙', capability: 'settings.manage' }] },
    ],
  },
  dispatcher: {
    role: 'dispatcher', label: 'Operations Workspace', subtitle: 'Allocate, monitor and recover daily jobs', homeHref: '/admin/operations-centre',
    nav: [
      { id: 'home', label: 'Operations', items: [{ id: 'dashboard', label: 'Operations Dashboard', href: '/admin/operations-centre', icon: '⌂' }] },
      { id: 'work', label: 'Daily Work', items: [
        { id: 'diary', label: 'Diary', href: '/admin/diary', icon: '□' },
        { id: 'unallocated', label: 'Unallocated Jobs', href: '/admin/fleet/assignments', icon: '⇄' },
        { id: 'active-jobs', label: 'Active Jobs', href: '/admin/fleet/active-jobs', icon: '▣' },
        { id: 'collections', label: 'Collections', href: '/admin/jobs?view=collections', icon: '↑' },
        { id: 'deliveries', label: 'Deliveries', href: '/admin/jobs?view=deliveries', icon: '↓' },
        { id: 'exceptions', label: 'Exceptions', href: '/admin/incidents', icon: '!' },
        { id: 'pod', label: 'POD Queue', href: '/admin/documents?view=pod', icon: '▤' },
      ] },
      { id: 'resources', label: 'Resources', items: [
        { id: 'drivers', label: 'Drivers', href: '/admin/drivers', icon: '◉' },
        { id: 'vehicles', label: 'Vehicles', href: '/admin/vehicles', icon: '▰' },
        { id: 'positions', label: 'Live Positions', href: '/admin/fleet/positions', icon: '⌖' },
      ] },
    ],
  },
  driver: {
    role: 'driver', label: 'Driver Workspace', subtitle: 'Today, assigned work and proof of delivery', homeHref: '/driver',
    nav: [
      { id: 'home', label: 'Driver', items: [{ id: 'today', label: 'Today', href: '/driver', icon: '⌂' }] },
      { id: 'work', label: 'My Work', items: [
        { id: 'jobs', label: 'My Jobs', href: '/driver/jobs', icon: '▣' },
        { id: 'diary', label: 'Diary', href: '/driver/history', icon: '□' },
        { id: 'availability', label: 'Availability', href: '/driver/availability', icon: '◷' },
      ] },
      { id: 'readiness', label: 'Readiness', items: [
        { id: 'vehicle', label: 'Vehicle', href: '/driver/vehicles', icon: '▰' },
        { id: 'documents', label: 'Documents', href: '/driver/documents', icon: '▤' },
      ] },
      { id: 'account', label: 'Account', items: [
        { id: 'messages', label: 'Messages', href: '/driver/messages', icon: '◫' },
        { id: 'profile', label: 'Account', href: '/driver/profile', icon: '◉' },
      ] },
    ],
  },
  owner_driver: {
    role: 'owner_driver', label: 'Owner Driver Workspace', subtitle: 'Find work, execute jobs and manage your business', homeHref: '/driver', primaryAction: { label: 'Find Loads', href: '/driver/loads', capability: 'loads.view.marketplace' },
    nav: [
      { id: 'home', label: 'Owner Driver', items: [{ id: 'dashboard', label: 'Owner Driver Dashboard', href: '/driver', icon: '⌂' }] },
      { id: 'commercial', label: 'Commercial', items: [
        { id: 'loads', label: 'Available Loads', href: '/driver/loads', icon: '▦' },
        { id: 'quotes', label: 'My Quotes', href: '/driver/quotes', icon: '◫' },
        { id: 'won-work', label: 'Won Work', href: '/driver/won-work', icon: '✓' },
      ] },
      { id: 'operations', label: 'My Work', items: [
        { id: 'jobs', label: 'My Jobs', href: '/driver/jobs', icon: '▣' },
        { id: 'diary', label: 'Diary', href: '/driver/history', icon: '□' },
        { id: 'returns', label: 'Return Journeys', href: '/driver/returns', icon: '↩' },
      ] },
      { id: 'business', label: 'Vehicle & Business', items: [
        { id: 'vehicle', label: 'Vehicle', href: '/driver/vehicles', icon: '▰' },
        { id: 'documents', label: 'Documents', href: '/driver/documents', icon: '▤' },
        { id: 'invoices', label: 'Invoices', href: '/driver/finance', icon: '£' },
        { id: 'profile', label: 'Account', href: '/driver/profile', icon: '◉' },
      ] },
    ],
  },
  finance: {
    role: 'finance', label: 'Finance Workspace', subtitle: 'Invoices, payments, balances and reporting', homeHref: '/admin/invoices',
    nav: [
      { id: 'finance', label: 'Finance', items: [
        { id: 'dashboard', label: 'Finance Dashboard', href: '/admin/invoices', icon: '⌂' },
        { id: 'customer-invoices', label: 'Customer Invoices', href: '/admin/invoices?type=customer', icon: '£' },
        { id: 'carrier-invoices', label: 'Carrier Invoices', href: '/admin/invoices?type=carrier', icon: '£' },
        { id: 'payments', label: 'Payments', href: '/admin/finance/payments', icon: '✓' },
        { id: 'balances', label: 'Outstanding Balances', href: '/admin/finance/balances', icon: '!' },
        { id: 'reports', label: 'Reports & Exports', href: '/admin/finance/reports', icon: '▤' },
      ] },
    ],
  },
  compliance: {
    role: 'compliance', label: 'Compliance Workspace', subtitle: 'Verification, expiry and operational readiness', homeHref: '/admin/documents',
    nav: [
      { id: 'compliance', label: 'Compliance', items: [
        { id: 'dashboard', label: 'Compliance Dashboard', href: '/admin/documents', icon: '⌂' },
        { id: 'driver-docs', label: 'Driver Documents', href: '/admin/documents?type=driver', icon: '▤' },
        { id: 'vehicle-docs', label: 'Vehicle Documents', href: '/admin/documents?type=vehicle', icon: '▤' },
        { id: 'company-docs', label: 'Company Documents', href: '/admin/documents?type=company', icon: '▤' },
        { id: 'verification', label: 'Verification Queue', href: '/admin/documents?view=pending', icon: '✓' },
        { id: 'expiry', label: 'Expiry Calendar', href: '/admin/documents/expiry', icon: '◷' },
        { id: 'incidents', label: 'Incidents', href: '/admin/incidents', icon: '!' },
      ] },
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

export const getWorkspaceHomeRoute = (user: WorkspaceUserLike | null | undefined): string =>
  WORKSPACE_DEFINITIONS[resolveWorkspaceRole(user)].homeHref;
