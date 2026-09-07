import type { ReactNode } from 'react';
import type { WorkspaceShellFixtureOverrides } from '../../components/workspace/WorkspaceShell';
import type { WorkspaceDefinition } from '../../../lib/workspaceRole';
import SuperAdminCardNavigationShell from './SuperAdminCardNavigationShell';

export const SUPER_ADMIN_WORKSPACE_DEFINITION: WorkspaceDefinition = {
  role: 'platform_owner',
  label: 'Platform Owner',
  subtitle: 'Global logistics control plane',
  homeHref: '/super-admin',
  nav: [
    { id: 'command', label: 'Command', items: [
      { id: 'command-centre', label: 'Command Centre', href: '/super-admin' },
      { id: 'action-centre', label: 'Action Centre', href: '/super-admin/action-centre' },
      { id: 'live-operations-map', label: 'Live Operations Map', href: '/super-admin/operations/control-centre' },
      { id: 'global-search', label: 'Global Search', href: '/super-admin/search' },
      { id: 'analytics', label: 'Platform Analytics', href: '/super-admin/analytics' },
      { id: 'directory', label: 'Explore all areas', href: '/super-admin/directory' },
    ] },
    { id: 'marketplace-jobs', label: 'Marketplace & Jobs', items: [
      { id: 'marketplace', label: 'Live Marketplace', href: '/super-admin/marketplace' },
      { id: 'jobs', label: 'All Jobs', href: '/super-admin/operations/jobs' },
      { id: 'active-jobs', label: 'Active Jobs', href: '/super-admin/operations/active-jobs' },
      { id: 'pending-jobs', label: 'Pending Jobs', href: '/super-admin/operations/pending-jobs' },
      { id: 'completed-jobs', label: 'Completed Jobs', href: '/super-admin/operations/completed-jobs' },
      { id: 'quotes', label: 'Quotes', href: '/super-admin/operations/quotes' },
      { id: 'allocations', label: 'Allocations', href: '/super-admin/operations/allocations' },
      { id: 'deliveries', label: 'Deliveries', href: '/super-admin/operations/deliveries' },
      { id: 'disputes', label: 'Disputes', href: '/super-admin/operations/disputes' },
    ] },
    { id: 'secure-operations', label: 'Secure Operations', items: [
      { id: 'secure-loads', label: 'Secure Loads', href: '/super-admin/operations/secure-loads' },
      { id: 'pod-queue', label: 'POD Queue', href: '/super-admin/operations/pods' },
      { id: 'fleet-positions', label: 'Tracking & Fleet Positions', href: '/super-admin/operations/fleet-positions' },
    ] },
    { id: 'fleet', label: 'Fleet', items: [
      { id: 'drivers', label: 'Drivers', href: '/super-admin/users/drivers' },
      { id: 'driver-availability', label: 'Driver Availability', href: '/super-admin/operations/driver-availability' },
      { id: 'vehicles', label: 'Vehicle Registry', href: '/super-admin/fleet/vehicles' },
      { id: 'return-journeys', label: 'Return Journeys', href: '/super-admin/fleet/return-journeys' },
    ] },
    { id: 'companies', label: 'Companies', items: [
      { id: 'companies', label: 'All Companies', href: '/super-admin/companies' },
      { id: 'brokers', label: 'Broker Oversight', href: '/super-admin/companies/brokers' },
      { id: 'memberships', label: 'Membership & Access', href: '/super-admin/companies/memberships' },
      { id: 'approvals', label: 'Pending Approval', href: '/super-admin/companies/approvals' },
      { id: 'active-companies', label: 'Active Companies', href: '/super-admin/companies/active' },
      { id: 'suspended-companies', label: 'Suspended Companies', href: '/super-admin/companies/suspended' },
      { id: 'verification', label: 'Verification', href: '/super-admin/companies/verification' },
      { id: 'company-compliance', label: 'Company Compliance', href: '/super-admin/companies/compliance' },
    ] },
    { id: 'finance', label: 'Finance', items: [
      { id: 'finance-overview', label: 'Finance Overview', href: '/super-admin/finance' },
      { id: 'invoices', label: 'Invoices', href: '/super-admin/finance/invoices' },
      { id: 'payments', label: 'Payments', href: '/super-admin/finance/payments' },
      { id: 'revenue', label: 'Revenue', href: '/super-admin/finance/revenue' },
      { id: 'subscriptions', label: 'Membership Subscriptions', href: '/super-admin/finance/subscriptions' },
      { id: 'stripe-webhooks', label: 'Stripe / Webhooks', href: '/super-admin/finance/stripe-webhooks' },
      { id: 'fees', label: 'Financial Breakdown', href: '/super-admin/finance/fees' },
    ] },
    { id: 'compliance', label: 'Compliance', items: [
      { id: 'fraud-cases', label: 'Identity & Fraud Review', href: '/super-admin/compliance/fraud-cases' },
      { id: 'insurance', label: 'Insurance', href: '/super-admin/compliance/insurance' },
      { id: 'operator-licences', label: 'Operator Licences', href: '/super-admin/compliance/operator-licences' },
      { id: 'expiries', label: 'Expiry Tracking', href: '/super-admin/compliance/expiries' },
      { id: 'documents', label: 'Document Review', href: '/super-admin/compliance/documents' },
    ] },
    { id: 'support', label: 'Support', items: [
      { id: 'tickets', label: 'Support Tickets', href: '/super-admin/support/tickets' },
      { id: 'complaints', label: 'Complaints', href: '/super-admin/support/complaints' },
      { id: 'support-disputes', label: 'Support Disputes', href: '/super-admin/support/disputes' },
    ] },
    { id: 'platform', label: 'Platform', items: [
      { id: 'users-access', label: 'Users & Access', href: '/super-admin/users' },
      { id: 'roles-permissions', label: 'Roles & Permissions', href: '/super-admin/settings/roles-permissions' },
      { id: 'notifications', label: 'Notifications', href: '/super-admin/notifications' },
      { id: 'health', label: 'Platform Health', href: '/super-admin/health' },
      { id: 'audit', label: 'Audit Logs', href: '/super-admin/settings/audit-logs' },
      { id: 'global-settings', label: 'Global Settings', href: '/super-admin/settings/global' },
      { id: 'legal-agreements', label: 'Legal & Agreements', href: '/super-admin/settings/legal-agreements' },
      { id: 'feature-flags', label: 'Feature Flags', href: '/super-admin/settings/feature-flags' },
    ] },
  ],
};

export default function SuperAdminWorkspaceShell({ children, fixtureOverrides }: { children: ReactNode; fixtureOverrides?: WorkspaceShellFixtureOverrides }) {
  return <SuperAdminCardNavigationShell definition={SUPER_ADMIN_WORKSPACE_DEFINITION} fixtureOverrides={fixtureOverrides}>{children}</SuperAdminCardNavigationShell>;
}
