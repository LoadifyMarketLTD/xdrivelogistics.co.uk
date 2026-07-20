import type { AppUserRole } from './authRole';

export type WorkspaceKind =
  | 'platform_owner'
  | 'customer'
  | 'broker'
  | 'carrier'
  | 'fleet'
  | 'dispatcher'
  | 'employed_driver'
  | 'owner_driver'
  | 'finance'
  | 'compliance';

export type WorkspaceNavItem = {
  id: string;
  label: string;
  href: string;
  icon: string;
};

export type WorkspaceNavSection = {
  id: string;
  label: string;
  items: WorkspaceNavItem[];
};

export type WorkspaceDefinition = {
  kind: WorkspaceKind;
  eyebrow: string;
  title: string;
  description: string;
  primaryAction?: { label: string; href: string };
  navigation: WorkspaceNavSection[];
};

const item = (id: string, label: string, href: string, icon: string): WorkspaceNavItem => ({ id, label, href, icon });

export const WORKSPACE_DEFINITIONS: Record<WorkspaceKind, WorkspaceDefinition> = {
  platform_owner: {
    kind: 'platform_owner',
    eyebrow: 'Platform administration',
    title: 'Platform Control Centre',
    description: 'Govern the XDrive network, security, onboarding, operations and service health.',
    navigation: [],
  },
  customer: {
    kind: 'customer',
    eyebrow: 'Customer workspace',
    title: 'Transport Dashboard',
    description: 'Post freight, compare quotes, track deliveries, review POD and manage invoices.',
    primaryAction: { label: 'Post load', href: '/customer/post-load' },
    navigation: [
      { id: 'customer-home', label: 'Customer', items: [item('customerDashboard', 'Dashboard', '/customer', '🏠'), item('postLoad', 'Post Load', '/customer/post-load', '➕'), item('customerLoads', 'My Loads', '/customer/loads', '📦')] },
      { id: 'customer-commercial', label: 'Quotes & Awards', items: [item('customerQuotes', 'Quotes', '/customer/quotes', '💬'), item('customerAwards', 'Awards', '/customer/awards', '🏆')] },
      { id: 'customer-delivery', label: 'Delivery', items: [item('customerDeliveries', 'Deliveries', '/customer/deliveries', '🚚'), item('customerDocuments', 'POD & Documents', '/customer/documents', '📄'), item('customerUpdates', 'Updates', '/customer/updates', '🔔')] },
      { id: 'customer-finance', label: 'Finance', items: [item('customerInvoices', 'Invoices', '/customer/invoices', '💷'), item('customerSettings', 'Settings', '/customer/settings', '⚙️')] },
    ],
  },
  broker: {
    kind: 'broker',
    eyebrow: 'Broker workspace',
    title: 'Broker Dashboard',
    description: 'Manage customer freight, carrier sourcing, awards, execution, POD and job profitability.',
    primaryAction: { label: 'Post customer load', href: '/broker/post-load' },
    navigation: [
      { id: 'broker-home', label: 'Broker', items: [item('brokerDashboard', 'Dashboard', '/broker', '🏠'), item('brokerCustomers', 'Customers', '/broker/customers', '🏢'), item('brokerLoads', 'Customer Loads', '/broker/loads', '📦'), item('brokerPostLoad', 'Post Load', '/broker/post-load', '➕')] },
      { id: 'broker-commercial', label: 'Carrier sourcing', items: [item('brokerQuotes', 'Carrier Quotes', '/broker/quotes', '💬'), item('brokerCompare', 'Compare Quotes', '/broker/compare-quotes', '⚖️'), item('brokerAwards', 'Awards', '/broker/awards', '🏆')] },
      { id: 'broker-operations', label: 'Operations', items: [item('brokerJobs', 'Active Jobs', '/broker/jobs', '🚚'), item('brokerPod', 'POD Review', '/broker/pod', '✅'), item('brokerDisputes', 'Disputes', '/broker/disputes', '⚠️')] },
      { id: 'broker-finance', label: 'Finance', items: [item('brokerMargin', 'Margin / Profit', '/broker/margins', '📈'), item('brokerCustomerInvoices', 'Customer Invoices', '/broker/invoices', '💷'), item('brokerCarrierCosts', 'Carrier Costs', '/broker/carrier-costs', '🧾'), item('brokerSettings', 'Settings', '/broker/settings', '⚙️')] },
    ],
  },
  carrier: {
    kind: 'carrier',
    eyebrow: 'Carrier workspace',
    title: 'Carrier Dashboard',
    description: 'Find work, price opportunities, allocate capacity and complete transport jobs.',
    primaryAction: { label: 'Find loads', href: '/admin/marketplace' },
    navigation: [],
  },
  fleet: {
    kind: 'fleet',
    eyebrow: 'Fleet operations',
    title: 'Fleet Dashboard',
    description: 'Control driver and vehicle capacity, assignments, live positions, compliance and exceptions.',
    primaryAction: { label: 'Open assignments', href: '/admin/diary' },
    navigation: [
      { id: 'fleet-home', label: 'Fleet', items: [item('fleetDashboard', 'Fleet Dashboard', '/admin/fleet', '🏠'), item('fleetDrivers', 'Drivers', '/admin/drivers', '👤'), item('fleetAvailability', 'Driver Availability', '/admin/drivers/availability', '🗓️'), item('fleetVehicles', 'Vehicles', '/admin/vehicles', '🚛')] },
      { id: 'fleet-live', label: 'Live operations', items: [item('fleetPositions', 'Live Positions', '/admin/fleet/positions', '🧭'), item('fleetAssignments', 'Assignments', '/admin/diary', '🔀'), item('fleetActiveJobs', 'Active Jobs', '/admin/jobs', '📦')] },
      { id: 'fleet-readiness', label: 'Readiness', items: [item('fleetMaintenance', 'Maintenance', '/admin/fleet/maintenance', '🔧'), item('fleetCompliance', 'Compliance', '/admin/documents', '🛡️'), item('fleetExpiry', 'Document Expiry', '/admin/documents/expiry', '⏳'), item('fleetIncidents', 'Incidents', '/admin/disputes', '⚠️')] },
      { id: 'fleet-planning', label: 'Planning', items: [item('fleetFuture', 'Future Availability', '/admin/returns', '↩️'), item('fleetSettings', 'Settings', '/admin/settings', '⚙️')] },
    ],
  },
  dispatcher: { kind: 'dispatcher', eyebrow: 'Operations', title: 'Operations Dashboard', description: 'Allocate work, track execution and resolve daily exceptions.', navigation: [] },
  employed_driver: { kind: 'employed_driver', eyebrow: 'Driver workspace', title: 'Today', description: 'Complete assigned work safely and keep each transport milestone up to date.', navigation: [] },
  owner_driver: { kind: 'owner_driver', eyebrow: 'Owner driver workspace', title: 'Owner Driver Dashboard', description: 'Find loads, quote, execute work, upload POD and invoice completed jobs.', navigation: [] },
  finance: { kind: 'finance', eyebrow: 'Finance', title: 'Finance Dashboard', description: 'Manage invoices, payments, balances, disputes and accounting exports.', navigation: [] },
  compliance: { kind: 'compliance', eyebrow: 'Compliance', title: 'Compliance Dashboard', description: 'Keep drivers, vehicles and company documentation ready to operate.', navigation: [] },
};

export const resolveWorkspaceKind = ({ role, membershipRole, companyType, ownerDriverWorkspace }: { role: AppUserRole | null; membershipRole?: string | null; companyType?: string | null; ownerDriverWorkspace?: boolean | null }): WorkspaceKind => {
  const type = (companyType ?? '').toLowerCase();
  const membership = (membershipRole ?? '').toLowerCase();
  if (role === 'owner' && !companyType) return 'platform_owner';
  if (role === 'customer' || type.includes('customer') || type.includes('shipper')) return 'customer';
  if (role === 'broker' || type.includes('broker')) return 'broker';
  if (ownerDriverWorkspace || type.includes('owner_driver')) return 'owner_driver';
  if (role === 'driver') return 'employed_driver';
  if (membership === 'finance' || membership === 'accounting') return 'finance';
  if (membership === 'compliance') return 'compliance';
  if (membership === 'dispatcher') return 'dispatcher';
  if (role === 'company_admin' && (type.includes('fleet') || type.includes('carrier') || type.includes('courier'))) return 'fleet';
  return 'carrier';
};
