'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import { COMPANY_CONFIG } from '../../config/company';

// ── Theme ─────────────────────────────────────────────────────────────────────

const THEME = {
  pageBg: '#0f172a',
  shellBg: '#1e293b',
  shellBorder: '#334155',
  shellMuted: '#94a3b8',
  shellText: '#f1f5f9',
  cardBg: '#1e293b',
  accent: '#f59e0b',
  accentHover: '#d97706',
  danger: '#ef4444',
  success: '#22c55e',
  radius: '8px',
};

// ── Nav ────────────────────────────────────────────────────────────────────────

type NavItem = { id: string; label: string; icon: string; href: string };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Governance',
    items: [
      { id: 'dashboard',   label: 'Platform Overview',  icon: '🏛️',  href: '/platform' },
      { id: 'analytics',   label: 'KPI & Analytics',    icon: '📊',  href: '/platform/analytics' },
      { id: 'audit',       label: 'Audit Log',          icon: '📋',  href: '/platform/audit' },
    ],
  },
  {
    label: 'Network Registry',
    items: [
      { id: 'companies',   label: 'Companies',          icon: '🏢',  href: '/platform/companies' },
      { id: 'brokers',     label: 'Brokers',            icon: '🤝',  href: '/platform/brokers' },
      { id: 'customers',   label: 'Customers',          icon: '👥',  href: '/platform/customers' },
      { id: 'drivers',     label: 'Drivers',            icon: '🚗',  href: '/platform/drivers' },
      { id: 'vehicles',    label: 'Vehicles',           icon: '🚛',  href: '/platform/vehicles' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'jobs',        label: 'All Jobs',           icon: '📦',  href: '/platform/jobs' },
      { id: 'bids',        label: 'All Bids',           icon: '💼',  href: '/platform/bids' },
      { id: 'invoices',    label: 'All Invoices',       icon: '💰',  href: '/platform/invoices' },
      { id: 'pods',        label: 'POD Artifacts',      icon: '📸',  href: '/platform/pods' },
    ],
  },
  {
    label: 'Risk & Compliance',
    items: [
      { id: 'compliance',  label: 'Compliance',         icon: '📄',  href: '/platform/compliance' },
      { id: 'trust',       label: 'Trust & Risk',       icon: '🛡️',  href: '/platform/trust' },
      { id: 'disputes',    label: 'Dispute Console',    icon: '⚖️',  href: '/platform/disputes' },
      { id: 'suspensions', label: 'Suspensions',        icon: '🚫',  href: '/platform/suspensions' },
    ],
  },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface PlatformWorkspaceShellProps {
  children: ReactNode;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PlatformWorkspaceShell({ children }: PlatformWorkspaceShellProps) {
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
    if (href === '/platform') return pathname === '/platform';
    return pathname === href || pathname.startsWith(href + '/');
  };

  if (!hydrated) {
    return <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg }} />;
  }

  const sidebarStyle: CSSProperties = {
    width: isMobile ? '270px' : '240px',
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
    padding: '0.45rem 0.65rem',
    backgroundColor: active ? 'rgba(245,158,11,0.12)' : 'transparent',
    color: active ? THEME.accent : THEME.shellText,
    border: 'none',
    borderLeft: active ? `3px solid ${THEME.accent}` : '3px solid transparent',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.82rem',
    fontWeight: active ? 600 : 400,
    borderRadius: '6px',
  });

  const iconStyle = (active: boolean): CSSProperties => ({
    width: '22px',
    height: '22px',
    borderRadius: '6px',
    display: 'grid',
    placeItems: 'center',
    fontSize: '0.82rem',
    backgroundColor: active ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)',
    flexShrink: 0,
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: THEME.pageBg }}>
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 30 }}
        />
      )}

      {/* Sidebar */}
      <aside style={sidebarStyle}>
        {/* Brand header */}
        <div style={{ padding: '1rem', borderBottom: `1px solid ${THEME.shellBorder}` }}>
          <button
            onClick={() => router.push('/platform')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', width: '100%' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: THEME.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <span style={{ color: '#0f172a', fontWeight: 900, fontSize: '0.9rem' }}>X</span>
              </div>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: THEME.shellText }}>{COMPANY_CONFIG.legalName}</span>
            </div>
          </button>
          <span style={{ display: 'inline-block', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: THEME.accent, backgroundColor: 'rgba(245,158,11,0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px', marginBottom: '0.25rem' }}>
            Platform Workspace
          </span>
          <div style={{ fontSize: '0.68rem', color: THEME.shellMuted, marginTop: '0.25rem' }}>Owner Governance Console</div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '0.5rem', overflowY: 'auto' }}>
          {NAV_GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: THEME.shellMuted, padding: '0.3rem 0.65rem 0.2rem' }}>
                {group.label}
              </div>
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <button
                    key={item.id}
                    onClick={() => { router.push(item.href); if (isMobile) setSidebarOpen(false); }}
                    style={navButtonStyle(active)}
                  >
                    <span style={iconStyle(active)}>{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '0.8rem', borderTop: `1px solid ${THEME.shellBorder}` }}>
          <div style={{ fontSize: '0.72rem', color: THEME.accent, marginBottom: '0.1rem', fontWeight: 700 }}>
            Platform Owner
          </div>
          <div style={{ fontSize: '0.7rem', color: THEME.shellMuted, marginBottom: '0.5rem', wordBreak: 'break-word' }}>
            {user?.email ?? ''}
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              onClick={() => router.push('/admin')}
              title="Switch to Company Workspace"
              style={{ flex: 1, padding: '0.38rem', backgroundColor: 'rgba(255,255,255,0.06)', color: THEME.shellText, border: `1px solid ${THEME.shellBorder}`, borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Company
            </button>
            <button
              onClick={() => void logout()}
              style={{ flex: 1, padding: '0.38rem', backgroundColor: 'rgba(239,68,68,0.12)', color: THEME.danger, border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile hamburger */}
      {isMobile && (
        <button
          onClick={() => setSidebarOpen(true)}
          style={{ position: 'fixed', top: '1rem', left: '1rem', zIndex: 20, backgroundColor: THEME.shellBg, border: `1px solid ${THEME.shellBorder}`, borderRadius: '8px', padding: '0.5rem', cursor: 'pointer', color: THEME.shellText, fontSize: '1.1rem', lineHeight: 1 }}
        >
          ☰
        </button>
      )}

      {/* Main content */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
