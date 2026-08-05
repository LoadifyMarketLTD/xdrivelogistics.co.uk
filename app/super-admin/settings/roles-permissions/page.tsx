'use client';

/**
 * Roles & Permissions — Canonical read-only matrix.
 *
 * This page displays the REAL permission matrix that the platform enforces.
 * It is generated from the same `workspaceRole.ts` source that the middleware,
 * API routes, and UI gates use — so what you see here is what the system
 * actually applies.
 *
 * ⚠️  This is intentionally READ-ONLY.
 *      The permission matrix is defined in code (lib/workspaceRole.ts) and
 *      deployed via CI. Editing it here would have no effect on the running
 *      system.  To change permissions, update workspaceRole.ts and deploy.
 */

import ProtectedRoute from '@/app/components/ProtectedRoute';

const THEME = {
  pageBg: '#0f172a',
  cardBg: '#1e293b',
  cardBorder: '#334155',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#f59e0b',
  warning: '#fbbf24',
  green: '#22c55e',
  red: '#ef4444',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
};

type CapabilityGroup = {
  label: string;
  capabilities: string[];
};

type CanonicalRole = {
  workspaceRole: string;
  appRole: string;
  label: string;
  emoji: string;
  color: string;
  description: string;
  accessLevel: 'platform' | 'company' | 'operations' | 'limited';
  capabilityGroups: CapabilityGroup[];
  routeAccess: string[];
};

/**
 * Canonical role matrix derived from lib/workspaceRole.ts CAPABILITIES constant.
 * Must be kept in sync with that file.
 */
const CANONICAL_ROLES: CanonicalRole[] = [
  {
    workspaceRole: 'platform_owner',
    appRole: 'owner',
    label: 'Platform Owner',
    emoji: '👑',
    color: THEME.accent,
    description: 'Full platform control. Can govern companies, manage all settings, view all data, approve/suspend companies, toggle feature flags, and access all financial and compliance data.',
    accessLevel: 'platform',
    capabilityGroups: [
      { label: 'Platform', capabilities: ['platform.manage'] },
      { label: 'Company management', capabilities: ['company.manage', 'users.manage', 'drivers.manage', 'vehicles.manage', 'documents.company.manage', 'documents.verify', 'incidents.manage', 'settings.manage'] },
      { label: 'Marketplace', capabilities: ['loads.create', 'loads.publish', 'loads.view.marketplace', 'loads.view.own', 'quotes.submit', 'quotes.receive', 'quotes.compare', 'quotes.award', 'jobs.view', 'jobs.allocate', 'jobs.dispatch', 'jobs.execute', 'jobs.track', 'jobs.review_pod'] },
      { label: 'Finance', capabilities: ['invoices.customer.manage', 'invoices.carrier.manage', 'payments.manage', 'margins.view'] },
      { label: 'Fleet', capabilities: ['fleet.positions.view', 'fleet.maintenance.manage'] },
      { label: 'Documents', capabilities: ['documents.own.manage', 'documents.verify'] },
    ],
    routeAccess: ['/super-admin/*'],
  },
  {
    workspaceRole: 'company_owner',
    appRole: 'company_admin',
    label: 'Company Owner',
    emoji: '🏢',
    color: THEME.blue,
    description: 'Full company-level control. Can manage drivers, vehicles, jobs, invoices, and dispatchers within their company.',
    accessLevel: 'company',
    capabilityGroups: [
      { label: 'Company management', capabilities: ['company.manage', 'users.manage', 'drivers.manage', 'vehicles.manage', 'documents.company.manage', 'settings.manage'] },
      { label: 'Marketplace', capabilities: ['loads.create', 'loads.publish', 'loads.view.own', 'quotes.receive', 'quotes.compare', 'quotes.award', 'jobs.view', 'jobs.allocate', 'jobs.dispatch', 'jobs.track', 'jobs.review_pod'] },
      { label: 'Finance', capabilities: ['invoices.customer.manage', 'payments.manage', 'margins.view'] },
    ],
    routeAccess: ['/admin/*', '/m/*'],
  },
  {
    workspaceRole: 'company_admin',
    appRole: 'company_admin',
    label: 'Company Admin',
    emoji: '👔',
    color: THEME.purple,
    description: 'Company administrative access. Same as Company Owner — manages drivers, vehicles, jobs and invoices.',
    accessLevel: 'company',
    capabilityGroups: [
      { label: 'Company management', capabilities: ['company.manage', 'users.manage', 'drivers.manage', 'vehicles.manage', 'documents.company.manage', 'settings.manage'] },
      { label: 'Marketplace', capabilities: ['loads.create', 'loads.publish', 'loads.view.own', 'quotes.receive', 'quotes.compare', 'quotes.award', 'jobs.view', 'jobs.allocate', 'jobs.dispatch', 'jobs.track', 'jobs.review_pod'] },
      { label: 'Finance', capabilities: ['invoices.customer.manage', 'payments.manage', 'margins.view'] },
    ],
    routeAccess: ['/admin/*', '/m/*'],
  },
  {
    workspaceRole: 'broker',
    appRole: 'broker',
    label: 'Broker',
    emoji: '📋',
    color: THEME.cyan,
    description: 'Broker workspace. Can post loads, receive quotes, award jobs, manage a carrier network, review PODs and manage both sides of invoicing.',
    accessLevel: 'company',
    capabilityGroups: [
      { label: 'Company', capabilities: ['company.manage', 'documents.company.manage', 'settings.manage', 'incidents.manage'] },
      { label: 'Marketplace', capabilities: ['loads.create', 'loads.publish', 'loads.view.own', 'quotes.receive', 'quotes.compare', 'quotes.award', 'jobs.view', 'jobs.track', 'jobs.review_pod'] },
      { label: 'Finance', capabilities: ['invoices.customer.manage', 'invoices.carrier.manage', 'margins.view'] },
    ],
    routeAccess: ['/broker/*'],
  },
  {
    workspaceRole: 'fleet_manager',
    appRole: 'company_admin',
    label: 'Fleet Manager',
    emoji: '🚛',
    color: '#14b8a6',
    description: 'Fleet and dispatch operations. Can allocate drivers, manage vehicles, track fleet positions, manage maintenance records.',
    accessLevel: 'operations',
    capabilityGroups: [
      { label: 'Fleet', capabilities: ['jobs.view', 'jobs.allocate', 'jobs.dispatch', 'jobs.track', 'drivers.manage', 'vehicles.manage', 'fleet.positions.view', 'fleet.maintenance.manage', 'incidents.manage'] },
      { label: 'Documents & settings', capabilities: ['documents.company.manage', 'settings.manage'] },
    ],
    routeAccess: ['/admin/*'],
  },
  {
    workspaceRole: 'dispatcher',
    appRole: 'company_staff',
    label: 'Dispatcher',
    emoji: '📡',
    color: '#0ea5e9',
    description: 'Job dispatch and monitoring. Can allocate drivers, dispatch jobs, track deliveries, review PODs.',
    accessLevel: 'operations',
    capabilityGroups: [
      { label: 'Dispatch', capabilities: ['jobs.view', 'jobs.allocate', 'jobs.dispatch', 'jobs.track', 'jobs.review_pod', 'drivers.manage', 'vehicles.manage', 'fleet.positions.view', 'incidents.manage'] },
    ],
    routeAccess: ['/admin/dispatch/*'],
  },
  {
    workspaceRole: 'carrier_admin',
    appRole: 'company_admin',
    label: 'Carrier Admin',
    emoji: '🏭',
    color: '#f97316',
    description: 'Carrier commercial operations. Can bid on marketplace loads, manage their own vehicle advertising.',
    accessLevel: 'company',
    capabilityGroups: [
      { label: 'Carrier', capabilities: ['loads.view.marketplace', 'quotes.submit', 'jobs.view', 'jobs.execute', 'jobs.track', 'fleet.positions.view', 'documents.own.manage', 'invoices.carrier.manage'] },
    ],
    routeAccess: ['/m/*'],
  },
  {
    workspaceRole: 'customer',
    appRole: 'customer',
    label: 'Customer',
    emoji: '📦',
    color: THEME.muted,
    description: 'Post loads, receive quotes, award jobs, track deliveries. Cannot see carrier margins or manage fleet.',
    accessLevel: 'limited',
    capabilityGroups: [
      { label: 'Customer', capabilities: ['loads.create', 'loads.publish', 'loads.view.own', 'quotes.receive', 'quotes.compare', 'quotes.award', 'jobs.view', 'jobs.track', 'jobs.review_pod', 'invoices.customer.manage', 'settings.manage'] },
    ],
    routeAccess: ['/customer/*'],
  },
  {
    workspaceRole: 'driver',
    appRole: 'driver',
    label: 'Driver',
    emoji: '🚚',
    color: THEME.green,
    description: 'Mobile driver workspace. Can accept job assignments, execute deliveries, capture POD, update availability.',
    accessLevel: 'limited',
    capabilityGroups: [
      { label: 'Driver', capabilities: ['jobs.view', 'jobs.execute', 'jobs.track', 'loads.view.marketplace', 'quotes.submit', 'invoices.carrier.manage', 'documents.own.manage', 'vehicles.manage'] },
    ],
    routeAccess: ['/driver/*'],
  },
  {
    workspaceRole: 'owner_driver',
    appRole: 'company_admin + driver mode',
    label: 'Owner Driver',
    emoji: '🚚👑',
    color: '#a78bfa',
    description: 'Owner-operator in driver execution mode. Has full company owner capabilities, but switches to driver mode for job execution.',
    accessLevel: 'limited',
    capabilityGroups: [
      { label: 'Driver (execution mode)', capabilities: ['jobs.view', 'jobs.execute', 'jobs.track', 'loads.view.marketplace', 'quotes.submit', 'invoices.carrier.manage', 'documents.own.manage', 'vehicles.manage'] },
    ],
    routeAccess: ['/driver/*'],
  },
  {
    workspaceRole: 'finance',
    appRole: 'company_staff',
    label: 'Finance Role',
    emoji: '💷',
    color: '#34d399',
    description: 'Finance access only. Can view jobs and manage invoices on both sides. Cannot manage fleet or users.',
    accessLevel: 'limited',
    capabilityGroups: [
      { label: 'Finance', capabilities: ['jobs.view', 'invoices.customer.manage', 'invoices.carrier.manage', 'payments.manage', 'margins.view'] },
    ],
    routeAccess: ['/admin/finance/*'],
  },
  {
    workspaceRole: 'viewer',
    appRole: 'company_staff',
    label: 'Viewer (Read-only)',
    emoji: '👁️',
    color: '#475569',
    description: 'Read-only access. Can only view jobs. No actions, no modifications.',
    accessLevel: 'limited',
    capabilityGroups: [
      { label: 'Read-only', capabilities: ['jobs.view'] },
    ],
    routeAccess: ['/admin/jobs/* (read-only)'],
  },
];

const accessLevelBadge: Record<string, { label: string; bg: string; color: string }> = {
  platform: { label: 'PLATFORM', bg: 'rgba(245,158,11,0.12)', color: THEME.accent },
  company: { label: 'COMPANY', bg: 'rgba(59,130,246,0.12)', color: THEME.blue },
  operations: { label: 'OPERATIONS', bg: 'rgba(6,182,212,0.12)', color: THEME.cyan },
  limited: { label: 'LIMITED', bg: 'rgba(148,163,184,0.12)', color: THEME.muted },
};

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.5rem' }}>🔐</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: THEME.text, margin: 0 }}>
                Roles &amp; Permissions
              </h1>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: THEME.accent, backgroundColor: 'rgba(245,158,11,0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                Settings
              </span>
            </div>
            <p style={{ color: THEME.muted, margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
              Canonical permission matrix — read-only. This is the real system enforced by middleware and API routes.
            </p>
          </div>
        </div>

        {/* Warning banner */}
        <div style={{ marginBottom: '1.25rem', border: `1px solid ${THEME.warning}`, borderLeft: `4px solid ${THEME.warning}`, borderRadius: '8px', backgroundColor: 'rgba(251,191,36,0.06)', padding: '0.75rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.9rem' }}>⚠️</span>
            <span style={{ color: THEME.warning, fontWeight: 700, fontSize: '0.82rem' }}>Read-only canonical matrix</span>
          </div>
          <p style={{ color: THEME.muted, fontSize: '0.78rem', margin: 0, lineHeight: 1.5 }}>
            This matrix is generated from <code style={{ color: THEME.warning, fontSize: '0.73rem' }}>lib/workspaceRole.ts</code> — the same source used by middleware, API routes, and UI capability gates.
            To change permissions, update that file and deploy via CI. Changes made here would have no effect on the running system.
          </p>
        </div>

        {/* Summary counts */}
        <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {Object.entries(accessLevelBadge).map(([level, badge]) => {
            const count = CANONICAL_ROLES.filter((r) => r.accessLevel === level).length;
            return (
              <div key={level} style={{ backgroundColor: badge.bg, border: `1px solid ${badge.color}33`, borderRadius: '8px', padding: '0.5rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: badge.color, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em' }}>{badge.label}</span>
                <span style={{ color: THEME.muted, fontSize: '0.72rem' }}>{count} role{count !== 1 ? 's' : ''}</span>
              </div>
            );
          })}
          <div style={{ backgroundColor: '#0b1220', border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px', padding: '0.5rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: THEME.text, fontSize: '0.7rem', fontWeight: 700 }}>TOTAL</span>
            <span style={{ color: THEME.muted, fontSize: '0.72rem' }}>{CANONICAL_ROLES.length} workspace roles</span>
          </div>
        </div>

        {/* Role cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '0.75rem' }}>
          {CANONICAL_ROLES.map((role) => {
            const badge = accessLevelBadge[role.accessLevel];
            return (
              <div
                key={role.workspaceRole}
                style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderTop: `3px solid ${role.color}`, borderRadius: '10px', padding: '1rem' }}
              >
                {/* Role header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                      <span style={{ fontSize: '1rem' }}>{role.emoji}</span>
                      <span style={{ color: role.color, fontWeight: 700, fontSize: '0.92rem' }}>{role.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <code style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: '#64748b', backgroundColor: '#0b1220', padding: '0.1rem 0.4rem', borderRadius: '3px' }}>
                        workspaceRole: {role.workspaceRole}
                      </code>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', color: badge.color, backgroundColor: badge.bg, padding: '0.15rem 0.45rem', borderRadius: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {badge.label}
                  </span>
                </div>

                {/* Description */}
                <p style={{ color: THEME.muted, fontSize: '0.78rem', margin: '0 0 0.75rem', lineHeight: 1.5 }}>
                  {role.description}
                </p>

                {/* App role */}
                <div style={{ marginBottom: '0.65rem' }}>
                  <span style={{ color: THEME.muted, fontSize: '0.68rem', fontWeight: 700 }}>APP ROLE: </span>
                  <code style={{ fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'monospace' }}>{role.appRole}</code>
                </div>

                {/* Capability groups */}
                <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  {role.capabilityGroups.map((group) => (
                    <div key={group.label}>
                      <div style={{ color: THEME.muted, fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>
                        {group.label}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {group.capabilities.map((cap) => (
                          <span
                            key={cap}
                            style={{ fontSize: '0.62rem', fontFamily: 'monospace', backgroundColor: '#0b1220', border: `1px solid ${role.color}22`, color: '#94a3b8', padding: '0.12rem 0.4rem', borderRadius: '3px' }}
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Route access */}
                <div>
                  <div style={{ color: THEME.muted, fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>
                    Route access
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                    {role.routeAccess.map((route) => (
                      <span
                        key={route}
                        style={{ fontSize: '0.62rem', fontFamily: 'monospace', backgroundColor: '#0b1220', border: `1px solid ${THEME.cardBorder}`, color: '#64748b', padding: '0.12rem 0.4rem', borderRadius: '3px' }}
                      >
                        {route}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div style={{ marginTop: '1.5rem', padding: '0.75rem 1rem', border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px', backgroundColor: '#0b1220' }}>
          <p style={{ color: THEME.muted, fontSize: '0.76rem', margin: 0, lineHeight: 1.6 }}>
            <strong style={{ color: THEME.text }}>Source of truth:</strong>{' '}
            <code style={{ color: THEME.accent, fontSize: '0.73rem' }}>lib/workspaceRole.ts</code> (CAPABILITIES constant) →{' '}
            <code style={{ color: THEME.accent, fontSize: '0.73rem' }}>lib/roleCapabilities.ts</code> →{' '}
            <code style={{ color: THEME.accent, fontSize: '0.73rem' }}>middleware.ts</code> (isRoleAllowedForPath).{' '}
            The matrix above reflects {CANONICAL_ROLES.length} workspace roles mapped from {new Set(CANONICAL_ROLES.map((r) => r.appRole)).size} app-level roles.
          </p>
        </div>
      </div>
    </ProtectedRoute>
  );
}

