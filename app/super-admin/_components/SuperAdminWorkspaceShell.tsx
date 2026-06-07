'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import { COMPANY_CONFIG } from '../../config/company';

type NavItem = { id: string; label: string; icon: string; href: string };
type NavGroup = { label: string; items: NavItem[] };

const THEME = {
  pageBg: '#0f172a',
  shellBg: '#1e293b',
  shellBorder: '#334155',
  shellMuted: '#94a3b8',
  shellText: '#f1f5f9',
  accent: '#f59e0b',
  danger: '#ef4444',
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Platform',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: '🏛️', href: '/super-admin' },
      { id: 'analytics', label: 'Platform Analytics', icon: '📊', href: '/super-admin/analytics' },
      { id: 'health', label: 'Platform Health', icon: '🩺', href: '/super-admin/health' },
      { id: 'notifications', label: 'System Notifications', icon: '🔔', href: '/super-admin/notifications' },
    ],
  },
  {
    label: 'Companies',
    items: [
      { id: 'companies-all', label: 'All Companies', icon: '🏢', href: '/super-admin/companies' },
      { id: 'companies-approvals', label: 'Approvals Queue', icon: '✅', href: '/super-admin/companies/approvals' },
      { id: 'companies-suspended', label: 'Suspended Companies', icon: '🚫', href: '/super-admin/companies/suspended' },
      { id: 'companies-active', label: 'Active Companies', icon: '🟢', href: '/super-admin/companies/active' },
      { id: 'companies-verification', label: 'Verification Status', icon: '🪪', href: '/super-admin/companies/verification' },
      { id: 'companies-compliance', label: 'Compliance Status', icon: '📄', href: '/super-admin/companies/compliance' },
    ],
  },
  {
    label: 'Users',
    items: [
      { id: 'users-all', label: 'All Users', icon: '👥', href: '/super-admin/users' },
      { id: 'users-drivers', label: 'Drivers', icon: '🚗', href: '/super-admin/users/drivers' },
      { id: 'users-dispatchers', label: 'Dispatchers', icon: '🧭', href: '/super-admin/users/dispatchers' },
      { id: 'users-customers', label: 'Customers', icon: '🛒', href: '/super-admin/users/customers' },
      { id: 'users-company-owners', label: 'Company Owners', icon: '🧑‍💼', href: '/super-admin/users/company-owners' },
      { id: 'users-platform-admins', label: 'Platform Admins', icon: '🛡️', href: '/super-admin/users/platform-admins' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'ops-marketplace', label: 'Marketplace', icon: '🌍', href: '/super-admin/marketplace' },
      { id: 'ops-jobs', label: 'All Jobs', icon: '📦', href: '/super-admin/operations/jobs' },
      { id: 'ops-active-jobs', label: 'Active Jobs', icon: '🟢', href: '/super-admin/operations/active-jobs' },
      { id: 'ops-pending-jobs', label: 'Pending Jobs', icon: '🕒', href: '/super-admin/operations/pending-jobs' },
      { id: 'ops-completed-jobs', label: 'Completed Jobs', icon: '✅', href: '/super-admin/operations/completed-jobs' },
      { id: 'ops-quotes', label: 'All Quotes', icon: '💬', href: '/super-admin/operations/quotes' },
      { id: 'ops-allocations', label: 'All Allocations', icon: '🧩', href: '/super-admin/operations/allocations' },
      { id: 'ops-deliveries', label: 'All Deliveries', icon: '🚚', href: '/super-admin/operations/deliveries' },
      { id: 'ops-driver-availability', label: 'Driver Availability', icon: '🧭', href: '/super-admin/operations/driver-availability' },
      { id: 'ops-fleet-positions', label: 'Fleet Positions', icon: '📍', href: '/super-admin/operations/fleet-positions' },
      { id: 'ops-disputes', label: 'Disputes', icon: '⚖️', href: '/super-admin/operations/disputes' },
      { id: 'ops-pods', label: 'POD Queue', icon: '📸', href: '/super-admin/operations/pods' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { id: 'finance-invoices', label: 'Platform Invoices', icon: '🧾', href: '/super-admin/finance/invoices' },
      { id: 'finance-fees', label: 'Platform Fees', icon: '💷', href: '/super-admin/finance/fees' },
      { id: 'finance-revenue', label: 'Revenue Reports', icon: '📈', href: '/super-admin/finance/revenue' },
      { id: 'finance-payments', label: 'Payment History', icon: '💳', href: '/super-admin/finance/payments' },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { id: 'compliance-insurance', label: 'Insurance Monitoring', icon: '🛡️', href: '/super-admin/compliance/insurance' },
      { id: 'compliance-operator-licences', label: 'Operator Licence Monitoring', icon: '📋', href: '/super-admin/compliance/operator-licences' },
      { id: 'compliance-expiries', label: 'Expiry Tracking', icon: '⏰', href: '/super-admin/compliance/expiries' },
      { id: 'compliance-documents', label: 'Document Review', icon: '📁', href: '/super-admin/compliance/documents' },
    ],
  },
  {
    label: 'Support',
    items: [
      { id: 'support-tickets', label: 'Support Tickets', icon: '🎫', href: '/super-admin/support/tickets' },
      { id: 'support-complaints', label: 'Complaints', icon: '⚠️', href: '/super-admin/support/complaints' },
      { id: 'support-disputes', label: 'Disputes', icon: '⚖️', href: '/super-admin/support/disputes' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { id: 'settings-global', label: 'Global Platform Settings', icon: '⚙️', href: '/super-admin/settings/global' },
      { id: 'settings-roles', label: 'Roles & Permissions', icon: '🔐', href: '/super-admin/settings/roles-permissions' },
      { id: 'settings-flags', label: 'Feature Flags', icon: '🚩', href: '/super-admin/settings/feature-flags' },
      { id: 'settings-audit', label: 'Audit Logs', icon: '📚', href: '/super-admin/settings/audit-logs' },
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
    width: isMobile ? '286px' : '248px',
    backgroundColor: THEME.shellBg,
    color: THEME.shellText,
    display: 'flex',
    flexDirection: 'column',
    borderRight: `1px solid ${THEME.shellBorder}`,
    position: isMobile ? 'fixed' : 'relative',
    inset: isMobile ? '0 auto 0 0' : undefined,
    zIndex: isMobile ? 40 : undefined,
    transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
    transition: 'transform 0.2s ease',
    flexShrink: 0,
  };

  const navButtonStyle = (active: boolean): CSSProperties => ({
    width: '100%',
    padding: '0.42rem 0.62rem',
    backgroundColor: active ? 'rgba(245,158,11,0.12)' : 'transparent',
    color: active ? THEME.accent : THEME.shellText,
    border: 'none',
    borderLeft: active ? `3px solid ${THEME.accent}` : '3px solid transparent',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    fontSize: '0.78rem',
    fontWeight: active ? 700 : 500,
    borderRadius: '6px',
  });

  const iconStyle = (active: boolean): CSSProperties => ({
    width: '20px',
    height: '20px',
    borderRadius: '6px',
    display: 'grid',
    placeItems: 'center',
    fontSize: '0.75rem',
    backgroundColor: active ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)',
    flexShrink: 0,
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: THEME.pageBg }}>
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 30 }} />
      )}

      <aside style={sidebarStyle}>
        <div style={{ padding: '0.9rem', borderBottom: `1px solid ${THEME.shellBorder}` }}>
          <button onClick={() => router.push('/super-admin')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: THEME.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <span style={{ color: '#0f172a', fontWeight: 900, fontSize: '0.9rem' }}>X</span>
              </div>
              <span style={{ fontWeight: 700, fontSize: '0.86rem', color: THEME.shellText }}>{COMPANY_CONFIG.legalName}</span>
            </div>
          </button>
          <span style={{ display: 'inline-block', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: THEME.accent, backgroundColor: 'rgba(245,158,11,0.12)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
            Super Admin
          </span>
          <div style={{ fontSize: '0.66rem', color: THEME.shellMuted, marginTop: '0.22rem' }}>Global Platform Administration</div>
        </div>

        <nav style={{ flex: 1, padding: '0.45rem', overflowY: 'auto' }}>
          {NAV_GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: '0.45rem' }}>
              <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: THEME.shellMuted, padding: '0.28rem 0.6rem 0.18rem' }}>
                {group.label}
              </div>
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <button key={item.id} onClick={() => { router.push(item.href); if (isMobile) setSidebarOpen(false); }} style={navButtonStyle(active)}>
                    <span style={iconStyle(active)}>{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div style={{ padding: '0.75rem', borderTop: `1px solid ${THEME.shellBorder}` }}>
          <div style={{ fontSize: '0.7rem', color: THEME.accent, marginBottom: '0.12rem', fontWeight: 700 }}>Platform Administrator</div>
          <div style={{ fontSize: '0.68rem', color: THEME.shellMuted, marginBottom: '0.45rem', wordBreak: 'break-word' }}>{user?.email ?? ''}</div>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button onClick={() => router.push('/admin')} style={{ flex: 1, padding: '0.34rem', backgroundColor: 'rgba(255,255,255,0.06)', color: THEME.shellText, border: `1px solid ${THEME.shellBorder}`, borderRadius: '6px', fontSize: '0.67rem', fontWeight: 600, cursor: 'pointer' }}>
              Company
            </button>
            <button onClick={() => void logout()} style={{ flex: 1, padding: '0.34rem', backgroundColor: 'rgba(239,68,68,0.12)', color: THEME.danger, border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', fontSize: '0.67rem', fontWeight: 600, cursor: 'pointer' }}>
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {isMobile && (
        <button onClick={() => setSidebarOpen(true)} style={{ position: 'fixed', top: '1rem', left: '1rem', zIndex: 20, backgroundColor: THEME.shellBg, border: `1px solid ${THEME.shellBorder}`, borderRadius: '8px', padding: '0.5rem', cursor: 'pointer', color: THEME.shellText, fontSize: '1.1rem', lineHeight: 1 }}>
          ☰
        </button>
      )}

      <main style={{ flex: 1, overflowY: 'auto' }}>{children}</main>
    </div>
  );
}
