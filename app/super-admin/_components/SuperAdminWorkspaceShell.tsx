import type { ReactNode } from 'react';
import type { WorkspaceShellFixtureOverrides } from '../../components/workspace/WorkspaceShell';
import type { WorkspaceDefinition } from '../../../lib/workspaceRole';
import SuperAdminCardNavigationShell from './SuperAdminCardNavigationShell';

export const SUPER_ADMIN_WORKSPACE_DEFINITION: WorkspaceDefinition = {
  role: 'platform_owner',
  label: 'Platform Owner',
  subtitle: 'Global platform administration',
  homeHref: '/super-admin',
  nav: [
    { id: 'dashboard', label: 'Command Centre', items: [
      { id: 'command-centre', label: 'Overview', href: '/super-admin', icon: '⌂' },
      { id: 'analytics', label: 'Platform Analytics', href: '/super-admin/analytics', icon: '◫' },
      { id: 'health', label: 'Platform Health', href: '/super-admin/health', icon: '✓' },
    ] },
    { id: 'xdrive-logistics', label: 'XDrive Logistics', items: [
      { id: 'xdrive-overview', label: 'XDrive Overview', href: '/super-admin/xdrive-logistics', icon: '◎' },
      { id: 'xdrive-jobs', label: 'XDrive Jobs', href: '/super-admin/xdrive-logistics/jobs', icon: '▣' },
      { id: 'xdrive-marketplace', label: 'XDrive Marketplace', href: '/super-admin/xdrive-logistics/marketplace', icon: '▦' },
      { id: 'broker-workspace', label: 'Broker Workspace', href: '/broker', icon: '◎' },
    ] },
    { id: 'marketplace', label: 'Marketplace', items: [
      { id: 'marketplace', label: 'Marketplace Overview', href: '/super-admin/marketplace', icon: '▦' },
      { id: 'quotes', label: 'Quotes', href: '/super-admin/operations/quotes', icon: '◫' },
      { id: 'allocations', label: 'Allocations', href: '/super-admin/operations/allocations', icon: '⇄' },
      { id: 'disputes', label: 'Marketplace Disputes', href: '/super-admin/operations/disputes', icon: '!' },
    ] },
    { id: 'operations', label: 'Operations', items: [
      { id: 'jobs', label: 'All Jobs', href: '/super-admin/operations/jobs', icon: '▣' },
      { id: 'active-jobs', label: 'Active Jobs', href: '/super-admin/operations/active-jobs', icon: '→' },
      { id: 'pending-jobs', label: 'Pending Jobs', href: '/super-admin/operations/pending-jobs', icon: '◷' },
      { id: 'completed-jobs', label: 'Completed Jobs', href: '/super-admin/operations/completed-jobs', icon: '✓' },
      { id: 'deliveries', label: 'Deliveries', href: '/super-admin/operations/deliveries', icon: '↓' },
      { id: 'pods', label: 'POD Queue', href: '/super-admin/operations/pods', icon: '▤' },
    ] },
    { id: 'fleet', label: 'Drivers & Fleet', items: [
      { id: 'drivers', label: 'Drivers', href: '/super-admin/users/drivers', icon: '◉' },
      { id: 'driver-availability', label: 'Driver Availability', href: '/super-admin/operations/driver-availability', icon: '◷' },
      { id: 'fleet-positions', label: 'Fleet Positions', href: '/super-admin/operations/fleet-positions', icon: '⌖' },
    ] },
    { id: 'companies', label: 'Companies', items: [
      { id: 'companies', label: 'All Companies', href: '/super-admin/companies', icon: '◎' },
      { id: 'approvals', label: 'Pending Approval', href: '/super-admin/companies/approvals', icon: '!' },
      { id: 'active', label: 'Active Companies', href: '/super-admin/companies/active', icon: '✓' },
      { id: 'suspended', label: 'Suspended Companies', href: '/super-admin/companies/suspended', icon: '×' },
      { id: 'verification', label: 'Onboarding & Verification', href: '/super-admin/companies/verification', icon: '▤' },
      { id: 'company-compliance', label: 'Company Compliance', href: '/super-admin/companies/compliance', icon: '▤' },
    ] },
    { id: 'users-access', label: 'Users & Access', items: [
      { id: 'users', label: 'All Users', href: '/super-admin/users', icon: '◎' },
      { id: 'company-owners', label: 'Company Owners', href: '/super-admin/users/company-owners', icon: '◉' },
      { id: 'customers', label: 'Customers', href: '/super-admin/users/customers', icon: '◉' },
      { id: 'dispatchers', label: 'Dispatchers', href: '/super-admin/users/dispatchers', icon: '◉' },
      { id: 'drivers-access', label: 'Drivers', href: '/super-admin/users/drivers', icon: '◉' },
      { id: 'admins', label: 'Platform Admins', href: '/super-admin/users/platform-admins', icon: '◉' },
    ] },
    { id: 'finance', label: 'Finance', items: [
      { id: 'finance-overview', label: 'Finance Overview', href: '/super-admin/finance', icon: '£' },
      { id: 'invoices', label: 'Invoices', href: '/super-admin/finance/invoices', icon: '£' },
      { id: 'fees', label: 'Financial Breakdown', href: '/super-admin/finance/fees', icon: '%' },
      { id: 'revenue', label: 'Revenue', href: '/super-admin/finance/revenue', icon: '£' },
      { id: 'payments', label: 'Payments', href: '/super-admin/finance/payments', icon: '✓' },
    ] },
    { id: 'compliance', label: 'Compliance', items: [
      { id: 'documents', label: 'Document Review', href: '/super-admin/compliance/documents', icon: '▤' },
      { id: 'insurance', label: 'Insurance', href: '/super-admin/compliance/insurance', icon: '▤' },
      { id: 'licences', label: 'Operator Licences', href: '/super-admin/compliance/operator-licences', icon: '▤' },
      { id: 'expiries', label: 'Expiry Tracking', href: '/super-admin/compliance/expiries', icon: '◷' },
      { id: 'fraud-cases', label: 'Identity & Fraud Review', href: '/super-admin/compliance/fraud-cases', icon: '!' },
    ] },
    { id: 'support', label: 'Support & Cases', items: [
      { id: 'action-centre', label: 'Action Centre', href: '/super-admin/action-centre', icon: '!' },
      { id: 'case-centre', label: 'Case Centre', href: '/super-admin/cases', icon: '!' },
      { id: 'tickets', label: 'Support Tickets', href: '/super-admin/support/tickets', icon: '?' },
      { id: 'complaints', label: 'Complaints', href: '/super-admin/support/complaints', icon: '!' },
      { id: 'support-disputes', label: 'Support Disputes', href: '/super-admin/support/disputes', icon: '⇄' },
    ] },
    { id: 'platform', label: 'Platform & Security', items: [
      { id: 'global', label: 'Global Settings', href: '/super-admin/settings/global', icon: '⚙' },
      { id: 'roles', label: 'Roles & Permissions', href: '/super-admin/settings/roles-permissions', icon: '⚙' },
      { id: 'flags', label: 'Feature Flags', href: '/super-admin/settings/feature-flags', icon: '⚑' },
      { id: 'audit', label: 'Audit Logs', href: '/super-admin/settings/audit-logs', icon: '▤' },
      { id: 'notifications', label: 'Notifications', href: '/super-admin/notifications', icon: '!' },
    ] },
  ],
};

export default function SuperAdminWorkspaceShell({
  children,
  fixtureOverrides,
}: {
  children: ReactNode;
  fixtureOverrides?: WorkspaceShellFixtureOverrides;
}) {
  return (
    <SuperAdminCardNavigationShell
      definition={SUPER_ADMIN_WORKSPACE_DEFINITION}
      fixtureOverrides={fixtureOverrides}
    >
      {children}
    </SuperAdminCardNavigationShell>
  );
}
