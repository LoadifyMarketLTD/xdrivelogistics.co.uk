export type DashboardPersona = 'owner-operator' | 'shipper' | 'transport-broker' | 'fleet-operator';

export type DashboardNavItem = {
  label: string;
  href: string;
  description: string;
};

export type DashboardRoleConfig = {
  key: DashboardPersona;
  title: string;
  subtitle: string;
  badge: string;
  accent: string;
  hero: string;
  navItems: DashboardNavItem[];
};

export const dashboardRoleConfigs: Record<DashboardPersona, DashboardRoleConfig> = {
  'owner-operator': {
    key: 'owner-operator',
    title: 'Owner Operator Workspace',
    subtitle: 'Keep jobs, vehicles and delivery readiness in one place.',
    badge: 'Independent operator',
    accent: '#2563eb',
    hero: 'Track live work, confirm delivery status and stay organised without switching tools.',
    navItems: [
      { label: 'Overview', href: '/owner-operator', description: 'Daily summary' },
      { label: 'Loads', href: '/driver/loads', description: 'Browse available work' },
      { label: 'My jobs', href: '/driver/jobs', description: 'Assigned deliveries' },
      { label: 'Finance', href: '/driver/finance', description: 'Invoices and payment history' },
    ],
  },
  shipper: {
    key: 'shipper',
    title: 'Shipper Workspace',
    subtitle: 'Plan freight requests and monitor execution from one command centre.',
    badge: 'Customer access',
    accent: '#0f766e',
    hero: 'Post jobs, receive quotes and keep all delivery updates visible from a single workspace.',
    navItems: [
      { label: 'Overview', href: '/shipper', description: 'Live shipment summary' },
      { label: 'Request work', href: '/customer', description: 'Create and review loads' },
      { label: 'Quotes', href: '/customer', description: 'Compare carriers' },
      { label: 'Invoices', href: '/customer', description: 'Billing and payments' },
    ],
  },
  'transport-broker': {
    key: 'transport-broker',
    title: 'Transport Broker Workspace',
    subtitle: 'Coordinate loads, bids and awards with a shared operational view.',
    badge: 'Broker access',
    accent: '#7c3aed',
    hero: 'Manage the load desk effectively with quick access to live demand, carrier activity and invoices.',
    navItems: [
      { label: 'Overview', href: '/transport-broker', description: 'Commercial summary' },
      { label: 'Broker desk', href: '/broker', description: 'Load and bid management' },
      { label: 'Awards', href: '/broker/awards', description: 'Accepted carrier work' },
      { label: 'Invoices', href: '/admin/invoices', description: 'Finance oversight' },
    ],
  },
  'fleet-operator': {
    key: 'fleet-operator',
    title: 'Fleet Operator Workspace',
    subtitle: 'Run operations, vehicles and team capacity from one control surface.',
    badge: 'Fleet operations',
    accent: '#c2410c',
    hero: 'Coordinate vehicles, drivers and job status across the whole network without losing visibility.',
    navItems: [
      { label: 'Overview', href: '/fleet-operator', description: 'Operations summary' },
      { label: 'Fleet', href: '/admin/fleet', description: 'Driver and vehicle desk' },
      { label: 'Jobs', href: '/admin/jobs', description: 'Execution queue' },
      { label: 'Compliance', href: '/admin/documents', description: 'Document monitoring' },
    ],
  },
};

export const getDashboardRoleConfig = (key: DashboardPersona) => dashboardRoleConfigs[key];
