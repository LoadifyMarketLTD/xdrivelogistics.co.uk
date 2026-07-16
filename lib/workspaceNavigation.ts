import type { AppUserRole } from './authRole';
import type { RoleCapabilities } from './roleCapabilities';

export type WorkspaceArea = 'admin' | 'broker' | 'customer' | 'driver' | 'super-admin';

export type WorkspaceNavItem = {
  id: string;
  label: string;
  href: string;
  capability?: keyof RoleCapabilities;
  roles?: AppUserRole[];
};

const NAVIGATION: Record<WorkspaceArea, WorkspaceNavItem[]> = {
  customer: [
    { id: 'customer-home', label: 'Workspace', href: '/customer', roles: ['customer'] },
    { id: 'customer-jobs', label: 'Jobs & Quotes', href: '/customer', roles: ['customer'], capability: 'canPostLoads' },
    { id: 'customer-settings', label: 'Settings', href: '/customer/settings', roles: ['customer'] },
  ],
  broker: [
    { id: 'broker-home', label: 'Workspace', href: '/broker', roles: ['broker', 'owner'] },
    { id: 'broker-loads', label: 'Loads', href: '/broker/loads', roles: ['broker', 'owner'], capability: 'canPostLoads' },
    { id: 'broker-bids', label: 'Bids', href: '/broker/bids', roles: ['broker', 'owner'], capability: 'canReceiveQuotes' },
    { id: 'broker-awards', label: 'Awards', href: '/broker/awards', roles: ['broker', 'owner'], capability: 'canAwardJobs' },
  ],
  driver: [
    { id: 'driver-jobs', label: 'Jobs', href: '/driver/jobs', roles: ['driver'], capability: 'canExecuteJobs' },
    { id: 'driver-loads', label: 'Load Board', href: '/driver/loads', roles: ['driver'], capability: 'canViewExchangeLoads' },
    { id: 'driver-quotes', label: 'Quotes', href: '/driver/quotes', roles: ['driver'], capability: 'canQuoteLoads' },
    { id: 'driver-returns', label: 'Returns', href: '/driver/returns', roles: ['driver'], capability: 'canUseReturnJourneys' },
    { id: 'driver-finance', label: 'Finance', href: '/driver/finance', roles: ['driver'], capability: 'canViewInvoices' },
    { id: 'driver-documents', label: 'Documents', href: '/driver/documents', roles: ['driver'], capability: 'canUploadPod' },
    { id: 'driver-profile', label: 'Profile', href: '/driver/profile', roles: ['driver'] },
  ],
  admin: [
    { id: 'admin-home', label: 'Workspace', href: '/admin' },
    { id: 'admin-marketplace', label: 'Load Board', href: '/admin/marketplace', capability: 'canViewExchangeLoads' },
    { id: 'admin-quotes', label: 'Quotes', href: '/admin/quotes', capability: 'canReceiveQuotes' },
    { id: 'admin-bids', label: 'Bids', href: '/admin/bids', capability: 'canReceiveQuotes' },
    { id: 'admin-operations', label: 'Operations', href: '/admin/operations-centre', capability: 'canAllocateDrivers' },
    { id: 'admin-jobs', label: 'Jobs', href: '/admin/jobs', capability: 'canExecuteJobs' },
    { id: 'admin-fleet', label: 'Fleet', href: '/admin/fleet', capability: 'canManageFleet' },
    { id: 'admin-drivers', label: 'Drivers', href: '/admin/drivers', capability: 'canManageFleet' },
    { id: 'admin-documents', label: 'Documents', href: '/admin/documents', capability: 'canUploadPod' },
    { id: 'admin-finance', label: 'Finance', href: '/admin/invoices', capability: 'canViewInvoices' },
    { id: 'admin-settings', label: 'Settings', href: '/admin/settings', capability: 'canManageCompanyUsers' },
  ],
  'super-admin': [
    { id: 'super-home', label: 'Overview', href: '/super-admin', roles: ['owner'] },
    { id: 'super-marketplace', label: 'Marketplace', href: '/super-admin/marketplace', roles: ['owner'] },
    { id: 'super-operations', label: 'Operations', href: '/super-admin/operations/jobs', roles: ['owner'] },
    { id: 'super-companies', label: 'Companies', href: '/super-admin/companies', roles: ['owner'] },
    { id: 'super-users', label: 'Users', href: '/super-admin/users', roles: ['owner'] },
    { id: 'super-compliance', label: 'Compliance', href: '/super-admin/compliance/documents', roles: ['owner'] },
    { id: 'super-finance', label: 'Finance', href: '/super-admin/finance/revenue', roles: ['owner'] },
    { id: 'super-support', label: 'Support', href: '/super-admin/support/tickets', roles: ['owner'] },
    { id: 'super-settings', label: 'Platform', href: '/super-admin/settings/global', roles: ['owner'] },
  ],
};

export const getWorkspaceNavigation = (
  area: WorkspaceArea,
  role: AppUserRole | null,
  capabilities: RoleCapabilities
): WorkspaceNavItem[] => NAVIGATION[area].filter((item) => {
  if (item.roles && (!role || !item.roles.includes(role))) return false;
  return !item.capability || capabilities[item.capability];
});

export const isWorkspaceNavItemActive = (pathname: string, item: WorkspaceNavItem) => {
  if (item.href === '/admin' || item.href === '/broker' || item.href === '/customer' || item.href === '/super-admin') {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
};
