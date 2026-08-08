'use client';

import { SUPER_ADMIN_WORKSPACE_DEFINITION } from '../../_components/SuperAdminWorkspaceShell';
import {
  WORKSPACE_DEFINITIONS,
  getWorkspaceCapabilities,
  type WorkspaceCapability,
  type WorkspaceRole,
} from '../../../../lib/workspaceRole';

export const THEME = {
  pageBg: '#0B2F6B',
  cardBg: '#102A56',
  cardBorder: '#31527E',
  surface: '#081F47',
  text: '#FFFFFF',
  muted: '#C5D0E0',
  accent: '#F5A300',
  warning: '#F5A300',
  green: '#22C55E',
  red: '#EF4444',
  blue: '#1D57D8',
  purple: '#1D57D8',
  cyan: '#1D57D8',
} as const;

export type CapabilityGroup = {
  label: string;
  capabilities: WorkspaceCapability[];
};

export type CanonicalRole = {
  workspaceRole: WorkspaceRole;
  appRole: string;
  label: string;
  emoji: string;
  color: string;
  description: string;
  accessLevel: 'platform' | 'company' | 'operations' | 'limited';
  capabilityGroups: CapabilityGroup[];
  routeAccess: string[];
};

const ROLE_METADATA: Record<
  WorkspaceRole,
  Omit<CanonicalRole, 'workspaceRole' | 'label' | 'capabilityGroups' | 'routeAccess'>
> = {
  platform_owner: {
    appRole: 'owner',
    emoji: '👑',
    color: THEME.accent,
    description: 'Global platform control across governance, finance, compliance, support and operational intervention.',
    accessLevel: 'platform',
  },
  company_owner: {
    appRole: 'company_admin',
    emoji: '🏢',
    color: THEME.blue,
    description: 'Full company-level operational and commercial control.',
    accessLevel: 'company',
  },
  company_admin: {
    appRole: 'company_admin',
    emoji: '👔',
    color: THEME.blue,
    description: 'Company administration across operations, fleet, compliance and finance.',
    accessLevel: 'company',
  },
  carrier_admin: {
    appRole: 'company_admin',
    emoji: '🏭',
    color: THEME.blue,
    description: 'Carrier workspace for marketplace, execution, readiness and carrier finance.',
    accessLevel: 'company',
  },
  broker: {
    appRole: 'broker',
    emoji: '📋',
    color: THEME.blue,
    description: 'Broker workspace for customer loads, carrier sourcing, award decisions and margin control.',
    accessLevel: 'company',
  },
  customer: {
    appRole: 'customer',
    emoji: '📦',
    color: THEME.muted,
    description: 'Customer workspace for own loads, quote decisions, delivery tracking and invoices.',
    accessLevel: 'limited',
  },
  fleet_manager: {
    appRole: 'company_admin',
    emoji: '🚛',
    color: THEME.blue,
    description: 'Fleet workspace for allocation, live positions, maintenance and readiness.',
    accessLevel: 'operations',
  },
  dispatcher: {
    appRole: 'company_staff',
    emoji: '📡',
    color: THEME.blue,
    description: 'Operations workspace for dispatch, live execution and exception recovery.',
    accessLevel: 'operations',
  },
  driver: {
    appRole: 'driver',
    emoji: '🚚',
    color: THEME.blue,
    description: 'Driver execution workspace for assigned jobs, POD, availability and own documents.',
    accessLevel: 'limited',
  },
  owner_driver: {
    appRole: 'owner_driver',
    emoji: '🚚👑',
    color: THEME.accent,
    description: 'Owner-driver workspace for own jobs, quotes, documents and verified finance surfaces only.',
    accessLevel: 'limited',
  },
  finance: {
    appRole: 'company_staff',
    emoji: '💷',
    color: THEME.blue,
    description: 'Finance workspace for invoice control, payment status and balances.',
    accessLevel: 'limited',
  },
  compliance: {
    appRole: 'company_staff',
    emoji: '✅',
    color: THEME.blue,
    description: 'Compliance workspace for verification, expiry and readiness controls.',
    accessLevel: 'operations',
  },
  viewer: {
    appRole: 'company_staff',
    emoji: '👁️',
    color: '#F4F6F8',
    description: 'Read-only workspace limited to approved operational visibility.',
    accessLevel: 'limited',
  },
};

const CAPABILITY_GROUPS: Array<{
  label: string;
  includes: readonly WorkspaceCapability[];
}> = [
  { label: 'Platform', includes: ['platform.manage'] },
  { label: 'Company management', includes: ['company.manage', 'company.members.manage', 'settings.manage'] },
  { label: 'Commercial', includes: ['loads.create', 'loads.publish', 'loads.view.own', 'loads.view.marketplace', 'quotes.submit', 'quotes.receive', 'quotes.compare', 'quotes.award'] },
  { label: 'Jobs & operations', includes: ['jobs.view', 'jobs.allocate', 'jobs.dispatch', 'jobs.execute', 'jobs.track', 'jobs.review_pod', 'incidents.manage'] },
  { label: 'Fleet', includes: ['drivers.manage', 'vehicles.manage', 'fleet.positions.view', 'fleet.maintenance.manage'] },
  { label: 'Documents & compliance', includes: ['documents.own.manage', 'documents.company.manage', 'documents.verify'] },
  { label: 'Finance', includes: ['invoices.customer.manage', 'invoices.carrier.manage', 'payments.manage', 'margins.view'] },
];

const WORKSPACE_ROLE_ORDER: WorkspaceRole[] = [
  'platform_owner',
  'company_owner',
  'company_admin',
  'carrier_admin',
  'broker',
  'customer',
  'fleet_manager',
  'dispatcher',
  'driver',
  'owner_driver',
  'finance',
  'compliance',
  'viewer',
];

export const accessLevelBadge: Record<CanonicalRole['accessLevel'], { label: string; bg: string; color: string }> = {
  platform: { label: 'PLATFORM', bg: 'rgba(245,163,0,0.14)', color: THEME.accent },
  company: { label: 'COMPANY', bg: 'rgba(29,87,216,0.16)', color: '#9FC0FF' },
  operations: { label: 'OPERATIONS', bg: 'rgba(29,87,216,0.16)', color: '#9FC0FF' },
  limited: { label: 'LIMITED', bg: 'rgba(244,246,248,0.10)', color: THEME.muted },
};

const unique = <T,>(values: readonly T[]) => [...new Set(values)];

const groupCapabilities = (capabilities: readonly WorkspaceCapability[]): CapabilityGroup[] =>
  CAPABILITY_GROUPS
    .map(({ label, includes }) => ({
      label,
      capabilities: includes.filter((capability): capability is WorkspaceCapability => capabilities.includes(capability)),
    }))
    .filter((group) => group.capabilities.length > 0);

const getWorkspaceDefinitionForRole = (role: WorkspaceRole) =>
  role === 'platform_owner' ? SUPER_ADMIN_WORKSPACE_DEFINITION : WORKSPACE_DEFINITIONS[role];

const getWorkspaceRoutes = (role: WorkspaceRole) => {
  const definition = getWorkspaceDefinitionForRole(role);
  return unique([
    definition.homeHref,
    ...definition.nav.flatMap((group) => group.items.map((item) => item.href)),
  ]);
};

export const CANONICAL_ROLES: CanonicalRole[] = WORKSPACE_ROLE_ORDER.map((role) => {
  const metadata = ROLE_METADATA[role];
  const definition = getWorkspaceDefinitionForRole(role);
  const capabilities = getWorkspaceCapabilities(role);
  return {
    workspaceRole: role,
    appRole: metadata.appRole,
    label: definition.label,
    emoji: metadata.emoji,
    color: metadata.color,
    description: metadata.description,
    accessLevel: metadata.accessLevel,
    capabilityGroups: groupCapabilities(capabilities),
    routeAccess: getWorkspaceRoutes(role),
  };
});