'use client';

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthContext';
import type { AppUserRole } from '../../lib/authRole';
import { getNavSectionsForRole } from './workflowUi';

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  broker: 'Broker',
  company_admin: 'Company Admin',
  company_staff: 'Dispatcher / Staff',
  driver: 'Driver',
  customer: 'Customer',
};

const WORKSPACE_LABEL: Record<string, string> = {
  owner: 'Owner Workspace',
  broker: 'Broker Workspace',
  company_admin: 'Company Admin Workspace',
  company_staff: 'Dispatcher Workspace',
  driver: 'Driver Workspace',
  customer: 'Customer Workspace',
};

export default function AdminPlatformShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const isAdminHome = pathname === '/admin';

  const role = (user?.role ?? null) as AppUserRole | null;
  const navSections = getNavSectionsForRole(role, {
    membershipRole: user?.membershipRole ?? null,
    financeAccess: user?.financeAccess ?? null,
  });
  const navItems = navSections.flatMap((section) => section.items);

  const activeModule = useMemo(
    () => navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ?? null,
    [navItems, pathname],
  );

  const companyLabel = user?.companyId ? `Company ${user.companyId.slice(0, 8)}` : 'Company pending';
  const roleLabel = role ? ROLE_LABEL[role] ?? role : 'Role pending';
  const ownerDriverBusinessWorkspace =
    user?.ownerDriverWorkspace === true && role !== 'driver' && user?.canAccessDriverMode === true;
  const ownerDriverDriverMode =
    user?.ownerDriverWorkspace === true &&
    user?.canAccessDriverMode === true &&
    (role === 'driver' || user?.ownerDriverExecutionMode === true);
  const workspaceLabel = ownerDriverBusinessWorkspace
    ? 'Owner Driver Business Workspace'
    : ownerDriverDriverMode
      ? 'Owner Driver Driver Mode'
      : role
        ? WORKSPACE_LABEL[role] ?? 'Workspace'
        : 'Workspace';
  const moduleLabel = activeModule?.label ?? 'Module workspace';

  if (isAdminHome) {
    return <>{children}</>;
  }

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '0.9rem 1rem 0.6rem 1rem' }}>
        <section
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '0.9rem',
            marginBottom: '0.65rem',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {workspaceLabel}
              </div>
              <div style={{ fontSize: '1.02rem', fontWeight: 700, color: '#0f172a', marginTop: '0.12rem' }}>{moduleLabel}</div>
            </div>
            <button
              onClick={() => router.push(ownerDriverBusinessWorkspace ? '/admin/marketplace' : '/admin')}
              style={{
                padding: '0.48rem 0.78rem',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                background: '#ffffff',
                color: '#0f172a',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              Workspace home
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', marginTop: '0.65rem' }}>
            <ShellContextCard label="Workspace" value={workspaceLabel} />
            <ShellContextCard label="Role" value={roleLabel} />
            <ShellContextCard label="Company" value={companyLabel} />
            <ShellContextCard label="Module" value={moduleLabel} />
          </div>
        </section>

        <section
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '0.55rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(168px, 1fr))',
            gap: '0.42rem',
          }}
        >
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <button
                key={item.id}
                onClick={() => router.push(item.href)}
                style={{
                  border: active ? '1px solid #2563eb' : '1px solid #dbe4ef',
                  background: active ? '#eff6ff' : '#f8fafc',
                  borderRadius: '9px',
                  padding: '0.5rem 0.6rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, marginBottom: '0.18rem' }}>{item.icon}</div>
                <div style={{ fontSize: '0.76rem', color: active ? '#1d4ed8' : '#0f172a', fontWeight: 700 }}>{item.label}</div>
              </button>
            );
          })}
        </section>
      </div>

      {children}
    </div>
  );
}

function ShellContextCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.52rem 0.62rem', background: '#f8fafc' }}>
      <div style={{ fontSize: '0.67rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 700, marginTop: '0.15rem', wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}
