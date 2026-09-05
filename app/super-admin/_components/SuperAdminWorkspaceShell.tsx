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
    { id: 'dashboard', label: 'Dashboard', items: [
      { id: 'command-centre', label: 'Command Centre', href: '/super-admin', icon: '⌂' },
      { id: 'operations-control-centre', label: 'Operations Control Centre', href: '/super-admin/operations/control-centre', icon: '⌖' },
      { id: 'global-search', label: 'Global Search', href: '/super-admin/search', icon: '⌕' },
      { id: 'analytics', label: 'Platform Analytics', href: '/super-admin/analytics', icon: '◫' },
      { id: 'health', label: 'Platform Health', href: '/super-admin/health', icon: '✓' },
      { id: 'notifications', label: 'Notifications', href: '/super-admin/notifications', icon: '!' },
    ] },
    { id: 'marketplace', label: 'Marketplace', items: [
      { id: 'marketplace', label: 'Marketplace', href: '/super-admin/marketplace', icon: '▦' },
      { id: 'quotes', label: 'Quotes', href: '/super-admin/operations/quotes', icon: '◫' },
      { id: 'allocations', label: 'Allocations', href: '/super-admin/operations/allocations', icon: '⇄' },
      { id: 'disputes', label: 'Disputes', href: '/super-admin/operations/disputes', icon: '!' },
    ] },
    { id: 'operations', label: 'Operations', items: [
      { id: 'jobs', label: 'Jobs', href: '/super-admin/operations/jobs', icon: '▣' },
      { id: 'active-jobs', label: 'Active Jobs', href: '/super-admin/operations/active-jobs', icon: '→' },
      { id: 'pending-jobs', label: 'Pending Jobs', href: '/super-admin/operations/pending-jobs', icon: '◷' },
      { id: 'completed-jobs', label: 'Completed Jobs', href: '/super-admin/operations/completed-jobs', icon: '✓' },
      { id: 'deliveries', label: 'Deliveries', href: '/super-admin/operations/deliveries', icon: '↓' },
      { id: 'pods', label: 'POD Queue', href: '/super-admin/operations/pods', icon: '▤' },
    ] },
    { id: 'fleet', label: 'Fleet', items: [
      { id: 'drivers', label: 'Drivers', href: '/super-admin/users/drivers', icon: '◉' },
      { id: 'vehicles', label: 'Vehicle Registry', href: '/super-admin/fleet/vehicles', icon: '▰' },
      { id: 'return-journeys', label: 'Return Journeys', href: '/super-admin/fleet/return-journeys', icon: '↩' },
      { id: 'driver-availability', label: 'Driver Availability', href: '/super-admin/operations/driver-availability', icon: '◷' },
      { id: 'fleet-positions', label: 'Fleet Positions', href: '/super-admin/operations/fleet-positions', icon: '⌖' },
    ] },
    { id: 'companies', label: 'Companies', items: [
      { id: 'companies', label: 'All Companies', href: '/super-admin/companies', icon: '◎' },
      { id: 'brokers', label: 'Broker Oversight', href: '/super-admin/companies/brokers', icon: '◎' },
      { id: 'memberships', label: 'Membership & Access', href: '/super-admin/companies/memberships', icon: '◉' },
      { id: 'approvals', label: 'Pending Approval', href: '/super-admin/companies/approvals', icon: '!' },
      { id: 'active', label: 'Active Companies', href: '/super-admin/companies/active', icon: '✓' },
      { id: 'suspended', label: 'Suspended Companies', href: '/super-admin/companies/suspended', icon: '×' },
      { id: 'verification', label: 'Verification', href: '/super-admin/companies/verification', icon: '▤' },
      { id: 'company-compliance', label: 'Company Compliance', href: '/super-admin/companies/compliance', icon: '▤' },
    ] },
    { id: 'finance', label: 'Finance', items: [
      { id: 'finance-overview', label: 'Finance Overview', href: '/super-admin/finance', icon: '£' },
      { id: 'invoices', label: 'Invoices', href: '/super-admin/finance/invoices', icon: '£' },
      { id: 'payments', label: 'Payments', href: '/super-admin/finance/payments', icon: '✓' },
      { id: 'subscriptions', label: 'Membership Subscriptions', href: '/super-admin/finance/subscriptions', icon: '◉' },
      { id: 'stripe-webhooks', label: 'Stripe Webhooks', href: '/super-admin/finance/stripe-webhooks', icon: '↻' },
      { id: 'fees', label: 'Financial Breakdown', href: '/super-admin/finance/fees', icon: '%' },
      { id: 'revenue', label: 'Revenue', href: '/super-admin/finance/revenue', icon: '£' },
    ] },
    { id: 'compliance', label: 'Compliance', items: [
      { id: 'fraud-cases', label: 'Identity & Fraud Review', href: '/super-admin/compliance/fraud-cases', icon: '!' },
      { id: 'insurance', label: 'Insurance', href: '/super-admin/compliance/insurance', icon: '▤' },
      { id: 'licences', label: 'Operator Licences', href: '/super-admin/compliance/operator-licences', icon: '▤' },
      { id: 'expiries', label: 'Expiry Tracking', href: '/super-admin/compliance/expiries', icon: '◷' },
      { id: 'documents', label: 'Document Review', href: '/super-admin/compliance/documents', icon: '▤' },
    ] },
    { id: 'support', label: 'Support', items: [
      { id: 'tickets', label: 'Support Tickets', href: '/super-admin/support/tickets', icon: '?' },
      { id: 'complaints', label: 'Complaints', href: '/super-admin/support/complaints', icon: '!' },
      { id: 'support-disputes', label: 'Support Disputes', href: '/super-admin/support/disputes', icon: '⇄' },
    ] },
    { id: 'platform', label: 'Platform', items: [
      { id: 'global', label: 'Global Settings', href: '/super-admin/settings/global', icon: '⚙' },
      { id: 'legal-agreements', label: 'Legal & Agreements', href: '/super-admin/settings/legal-agreements', icon: '§' },
      { id: 'roles', label: 'Access Matrix', href: '/super-admin/settings/roles-permissions', icon: '⚙' },
      { id: 'flags', label: 'Feature Flags', href: '/super-admin/settings/feature-flags', icon: '⚑' },
      { id: 'audit', label: 'Audit Logs', href: '/super-admin/settings/audit-logs', icon: '▤' },
      { id: 'users', label: 'All Users', href: '/super-admin/users', icon: '◎' },
      { id: 'admins', label: 'Platform Admins', href: '/super-admin/users/platform-admins', icon: '◉' },
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
