'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import { COMPANY_CONFIG } from '../../config/company';

type NavItem = { id: string; label: string; shortLabel?: string; href: string };
type NavGroup = { label: string; summary: string; items: NavItem[] };

const THEME = {
  pageBg: '#eef2f6',
  shellBg: '#f8fafc',
  shellBorder: '#d7e0ea',
  shellMuted: '#64748b',
  shellText: '#0f172a',
  accent: '#f59e0b',
  blue: '#1d4ed8',
  danger: '#dc2626',
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Dashboard',
    summary: 'Global command view',
    items: [
      { id: 'dashboard', label: 'Owner Console', shortLabel: 'Console', href: '/super-admin' },
      { id: 'analytics', label: 'Platform Analytics', shortLabel: 'Analytics', href: '/super-admin/analytics' },
      { id: 'health', label: 'Platform Health', shortLabel: 'Health', href: '/super-admin/health' },
      { id: 'notifications', label: 'Notifications', shortLabel: 'Queue', href: '/super-admin/notifications' },
    ],
  },
  {
    label: 'Marketplace',
    summary: 'Loads, quotes and awards',
    items: [
      { id: 'marketplace', label: 'Marketplace', href: '/super-admin/marketplace' },
      { id: 'quotes', label: 'Quotes', href: '/super-admin/operations/quotes' },
      { id: 'allocations', label: 'Allocations', href: '/super-admin/operations/allocations' },
      { id: 'disputes', label: 'Disputes', href: '/super-admin/operations/disputes' },
    ],
  },
  {
    label: 'Operations',
    summary: 'Jobs and live movement',
    items: [
      { id: 'jobs', label: 'Jobs', href: '/super-admin/operations/jobs' },
      { id: 'active-jobs', label: 'Active Jobs', href: '/super-admin/operations/active-jobs' },
      { id: 'pending-jobs', label: 'Pending Jobs', href: '/super-admin/operations/pending-jobs' },
      { id: 'completed-jobs', label: 'Completed Jobs', href: '/super-admin/operations/completed-jobs' },
      { id: 'deliveries', label: 'Deliveries', href: '/super-admin/operations/deliveries' },
      { id: 'pods', label: 'POD Queue', href: '/super-admin/operations/pods' },
    ],
  },
  {
    label: 'Fleet',
    summary: 'Drivers and positions',
    items: [
      { id: 'drivers', label: 'Drivers', href: '/super-admin/users/drivers' },
      { id: 'driver-availability', label: 'Driver Availability', href: '/super-admin/operations/driver-availability' },
      { id: 'fleet-positions', label: 'Fleet Positions', href: '/super-admin/operations/fleet-positions' },
    ],
  },
  {
    label: 'Companies',
    summary: 'Network and approval',
    items: [
      { id: 'companies', label: 'All Companies', href: '/super-admin/companies' },
      { id: 'approvals', label: 'Pending Approval', href: '/super-admin/companies/approvals' },
      { id: 'active', label: 'Active Companies', href: '/super-admin/companies/active' },
      { id: 'suspended', label: 'Suspended Companies', href: '/super-admin/companies/suspended' },
      { id: 'verification', label: 'Verification', href: '/super-admin/companies/verification' },
      { id: 'company-compliance', label: 'Company Compliance', href: '/super-admin/companies/compliance' },
    ],
  },
  {
    label: 'Finance',
    summary: 'Invoices and payments',
    items: [
      { id: 'invoices', label: 'Invoices', href: '/super-admin/finance/invoices' },
      { id: 'fees', label: 'Financial Breakdown', href: '/super-admin/finance/fees' },
      { id: 'revenue', label: 'Revenue', href: '/super-admin/finance/revenue' },
      { id: 'payments', label: 'Payments', href: '/super-admin/finance/payments' },
    ],
  },
  {
    label: 'Compliance',
    summary: 'Documents, identity and expiry',
    items: [
      { id: 'fraud-cases', label: 'Identity & Fraud Review', href: '/super-admin/compliance/fraud-cases' },
      { id: 'insurance', label: 'Insurance', href: '/super-admin/compliance/insurance' },
      { id: 'licences', label: 'Operator Licences', href: '/super-admin/compliance/operator-licences' },
      { id: 'expiries', label: 'Expiry Tracking', href: '/super-admin/compliance/expiries' },
      { id: 'documents', label: 'Document Review', href: '/super-admin/compliance/documents' },
    ],
  },
  {
    label: 'Support',
    summary: 'Tickets and complaints',
    items: [
      { id: 'tickets', label: 'Support Tickets', href: '/super-admin/support/tickets' },
      { id: 'complaints', label: 'Complaints', href: '/super-admin/support/complaints' },
      { id: 'support-disputes', label: 'Support Disputes', href: '/super-admin/support/disputes' },
    ],
  },
  {
    label: 'Platform',
    summary: 'Settings and audit',
    items: [
      { id: 'global', label: 'Global Settings', href: '/super-admin/settings/global' },
      { id: 'roles', label: 'Roles & Permissions', href: '/super-admin/settings/roles-permissions' },
      { id: 'flags', label: 'Feature Flags', href: '/super-admin/settings/feature-flags' },
      { id: 'audit', label: 'Audit Logs', href: '/super-admin/settings/audit-logs' },
      { id: 'users', label: 'All Users', href: '/super-admin/users' },
      { id: 'admins', label: 'Platform Admins', href: '/super-admin/users/platform-admins' },
    ],
  },
];

interface SuperAdminWorkspaceShellProps {
  children: ReactNode;
}

export default function SuperAdminWorkspaceShell({ children }: SuperAdminWorkspaceShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const update = () => setIsMobile(window.innerWidth <= 1024);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (!isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const isActive = (href: string) => {
    if (href === '/super-admin') return pathname === '/super-admin';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  if (!hydrated) {
    return <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg }} />;
  }

  const sidebarStyle: CSSProperties = {
    width: isMobile ? '292px' : '254px',
    backgroundColor: THEME.shellBg,
    color: THEME.shellText,
    display: 'flex',
    flexDirection: 'column',
    borderRight: `1px solid ${THEME.shellBorder}`,
    position: isMobile ? 'fixed' : 'sticky',
    top: 0,
    height: '100vh',
    inset: isMobile ? '0 auto 0 0' : undefined,
    zIndex: isMobile ? 40 : undefined,
    transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
    transition: 'transform 0.2s ease',
    flexShrink: 0,
  };

  const navButtonStyle = (active: boolean): CSSProperties => ({
    width: '100%',
    padding: '0.42rem 0.55rem',
    backgroundColor: active ? '#eff6ff' : 'transparent',
    color: active ? THEME.blue : THEME.shellText,
    border: 'none',
    borderLeft: active ? `3px solid ${THEME.blue}` : '3px solid transparent',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.45rem',
    fontSize: '0.75rem',
    fontWeight: active ? 800 : 650,
    borderRadius: '8px',
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: THEME.pageBg }}>
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', zIndex: 30 }} />
      )}

      <aside style={sidebarStyle}>
        <div style={{ padding: '0.85rem 0.85rem 0.75rem', borderBottom: `1px solid ${THEME.shellBorder}`, backgroundColor: '#ffffff' }}>
          <button onClick={() => router.push('/super-admin')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.45rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#0f172a', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <span style={{ color: '#f59e0b', fontWeight: 900, fontSize: '1rem' }}>X</span>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.84rem', color: THEME.shellText, lineHeight: 1.15 }}>{COMPANY_CONFIG.legalName}</div>
                <div style={{ fontSize: '0.66rem', color: THEME.shellMuted, marginTop: '0.08rem' }}>Global Platform View</div>
              </div>
            </div>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-block', fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#92400e', backgroundColor: '#fef3c7', padding: '0.2rem 0.45rem', borderRadius: '999px' }}>
              Platform Owner
            </span>
            <button onClick={() => router.push('/admin')} style={{ border: '1px solid #dbe4ef', background: '#f8fafc', color: '#334155', borderRadius: '999px', padding: '0.2rem 0.45rem', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer' }}>
              Company View
            </button>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '0.55rem', overflowY: 'auto' }}>
          {NAV_GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: '0.46rem' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem', padding: '0.28rem 0.45rem 0.22rem' }}>
                <div style={{ fontSize: '0.62rem', fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569' }}>{group.label}</div>
                <div style={{ fontSize: '0.6rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>{group.items.length}</div>
              </div>
              <div style={{ display: 'grid', gap: '0.12rem' }}>
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <button key={item.id} onClick={() => { router.push(item.href); if (isMobile) setSidebarOpen(false); }} style={navButtonStyle(active)}>
                      <span>{item.shortLabel ?? item.label}</span>
                      {active && <span style={{ width: '6px', height: '6px', borderRadius: '999px', backgroundColor: THEME.blue }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div style={{ padding: '0.75rem', borderTop: `1px solid ${THEME.shellBorder}`, backgroundColor: '#ffffff' }}>
          <div style={{ fontSize: '0.66rem', color: '#92400e', marginBottom: '0.15rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Platform Administrator</div>
          <div style={{ fontSize: '0.68rem', color: THEME.shellMuted, marginBottom: '0.5rem', wordBreak: 'break-word' }}>{user?.email ?? ''}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
            <button onClick={() => router.push('/admin')} style={{ padding: '0.44rem', backgroundColor: '#ffffff', color: '#0f172a', border: `1px solid ${THEME.shellBorder}`, borderRadius: '8px', fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer' }}>
              Company
            </button>
            <button onClick={() => void logout()} style={{ padding: '0.44rem', backgroundColor: '#fef2f2', color: THEME.danger, border: '1px solid #fecaca', borderRadius: '8px', fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer' }}>
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {isMobile && (
        <button onClick={() => setSidebarOpen(true)} style={{ position: 'fixed', top: '1rem', left: '1rem', zIndex: 20, backgroundColor: '#ffffff', border: `1px solid ${THEME.shellBorder}`, borderRadius: '10px', padding: '0.55rem 0.65rem', cursor: 'pointer', color: THEME.shellText, fontSize: '1rem', lineHeight: 1, boxShadow: '0 8px 20px rgba(15,23,42,0.14)' }}>
          Menu
        </button>
      )}

      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>{children}</main>
    </div>
  );
}
