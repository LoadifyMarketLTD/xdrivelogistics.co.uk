'use client';

import ProtectedRoute from '@/app/components/ProtectedRoute';

const THEME = {
  pageBg: 'var(--background)',
  cardBg: 'var(--xd-surface)',
  cardBorder: 'var(--xd-border)',
  text: 'var(--xd-text)',
  muted: 'var(--xd-text-muted)',
  accent: 'var(--xd-gold)',
};

const ROLES = [
  {
    role: 'owner',
    label: '👑 Platform Owner',
    description: 'Full super-admin access. Can approve/suspend companies, view all data, manage all platform settings.',
    scopes: ['super-admin/*', 'all companies', 'all users', 'all finance', 'all compliance', 'audit logs', 'feature flags'],
    color: '#f59e0b',
  },
  {
    role: 'company_admin',
    label: '🏢 Company Admin',
    description: 'Manages their own company — drivers, vehicles, jobs, invoices, dispatchers.',
    scopes: ['company/drivers', 'company/vehicles', 'company/jobs', 'company/invoices', 'company/dispatchers'],
    color: '#3b82f6',
  },
  {
    role: 'admin_staff',
    label: '👔 Admin Staff',
    description: 'Company staff with administrative access. Can manage jobs and drivers within their company.',
    scopes: ['company/jobs', 'company/drivers', 'company/vehicles'],
    color: '#8b5cf6',
  },
  {
    role: 'dispatcher',
    label: '📡 Dispatcher',
    description: 'Assigns jobs to drivers, monitors active deliveries, manages job workflows.',
    scopes: ['dispatch/jobs', 'dispatch/allocations', 'dispatch/tracking'],
    color: '#06b6d4',
  },
  {
    role: 'driver',
    label: '🚚 Driver',
    description: 'Accepts and manages own job assignments. Can capture POD and update delivery status.',
    scopes: ['driver/jobs', 'driver/pod', 'driver/profile'],
    color: '#22c55e',
  },
  {
    role: 'customer',
    label: '📦 Customer',
    description: 'Can submit quote requests and track their own shipments.',
    scopes: ['quotes/request', 'quotes/track'],
    color: '#94a3b8',
  },
  {
    role: 'viewer',
    label: '👁️ Viewer',
    description: 'Read-only access to assigned company resources.',
    scopes: ['read-only'],
    color: '#475569',
  },
] as const;

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🔐</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: THEME.text, margin: 0 }}>Roles &amp; Permissions</h1>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: THEME.accent, backgroundColor: 'rgba(245,158,11,0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>Settings</span>
            </div>
            <p style={{ color: THEME.muted, margin: '0.25rem 0 0', fontSize: '0.85rem' }}>Platform role model and permission matrix. {ROLES.length} canonical roles defined.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '0.75rem' }}>
          {ROLES.map((role) => (
            <div
              key={role.role}
              style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '10px', padding: '1rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1rem' }}>{role.label.split(' ')[0]}</span>
                <span style={{ color: role.color, fontWeight: 700, fontSize: '0.88rem' }}>
                  {role.label.split(' ').slice(1).join(' ')}
                </span>
                <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: '#475569', backgroundColor: '#0b1220', padding: '0.15rem 0.45rem', borderRadius: '3px', marginLeft: 'auto' }}>
                  {role.role}
                </span>
              </div>
              <p style={{ color: THEME.muted, fontSize: '0.78rem', margin: '0 0 0.65rem' }}>{role.description}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {role.scopes.map((scope) => (
                  <span
                    key={scope}
                    style={{ fontSize: '0.65rem', backgroundColor: '#0b1220', border: `1px solid ${THEME.cardBorder}`, color: '#94a3b8', padding: '0.15rem 0.45rem', borderRadius: '4px' }}
                  >
                    {scope}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ProtectedRoute>
  );
}
