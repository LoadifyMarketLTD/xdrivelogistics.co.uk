'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import { COMPANY_CONFIG } from '../../config/company';

// ── Theme ─────────────────────────────────────────────────────────────────────

const THEME = {
  pageBg: '#eef2f6',
  shellBg: '#f8fafc',
  shellBorder: '#d7e0ea',
  shellMuted: '#64748b',
  shellText: '#0f172a',
  cardBg: '#ffffff',
  cardBorder: '#d7e0ea',
  cardShadow: '0 6px 16px rgba(15, 23, 42, 0.08)',
  radius: '10px',
  live: '#1d4ed8',
};

// ── Nav groups ────────────────────────────────────────────────────────────────

type NavItem = {
  id: string;
  label: string;
  icon: string;
  href: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Load Exchange',
    items: [
      { id: 'loads',      label: 'Available Loads',  icon: '📋', href: '/driver/loads' },
      { id: 'search',     label: 'Search Loads',     icon: '🔍', href: '/driver/loads/search' },
      { id: 'quotes',     label: 'My Quotes',        icon: '💬', href: '/driver/quotes' },
      { id: 'won-work',   label: 'Won Work',         icon: '🏆', href: '/driver/won-work' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'jobs',       label: 'Active Jobs',      icon: '🚚', href: '/driver/jobs' },
      { id: 'history',    label: 'Job History',      icon: '📚', href: '/driver/history' },
      { id: 'returns',    label: 'Return Journeys',  icon: '🔄', href: '/driver/returns' },
    ],
  },
  {
    label: 'Profile',
    items: [
      { id: 'availability', label: 'Availability',   icon: '📍', href: '/driver/availability' },
      { id: 'security',   label: 'Account Security', icon: '🔐', href: '/driver/change-password' },
    ],
  },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface DriverWorkspaceShellProps {
  children: ReactNode;
  /** Displayed in the header area below the workspace title */
  subtitle?: string;
  /** Custom header content rendered to the right of the title */
  headerActions?: ReactNode;
  /** Pass driver display name to show in sidebar footer */
  driverName?: string;
  /** Availability badge shown in sidebar footer */
  availabilityLabel?: string;
  /** Persona label shown in sidebar header */
  personaLabel?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DriverWorkspaceShell({
  children,
  subtitle,
  headerActions,
  driverName,
  availabilityLabel,
  personaLabel,
}: DriverWorkspaceShellProps) {
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

  const displayName = driverName ?? user?.email ?? 'Driver';
  const displayEmail = user?.email ?? '';

  // Derive active nav item from pathname
  const isActive = (href: string) => {
    if (href === '/driver/loads') {
      // Active only for exact /driver/loads, not /driver/loads/search
      return pathname === '/driver/loads';
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  if (!hydrated) {
    return <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg }} />;
  }

  const sidebarStyle: CSSProperties = {
    width: isMobile ? '270px' : '228px',
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
    padding: '0.5rem 0.65rem',
    backgroundColor: active ? '#eff6ff' : 'transparent',
    color: THEME.shellText,
    borderTop: 'none',
    borderRight: 'none',
    borderBottom: 'none',
    borderLeft: active ? `3px solid ${THEME.live}` : '3px solid transparent',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.83rem',
    fontWeight: active ? 600 : 500,
    borderRadius: '6px',
  });

  const iconBoxStyle = (active: boolean): CSSProperties => ({
    width: '22px',
    height: '22px',
    borderRadius: '6px',
    display: 'grid',
    placeItems: 'center',
    fontSize: '0.85rem',
    backgroundColor: active ? '#dbeafe' : '#e2e8f0',
    flexShrink: 0,
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: THEME.pageBg }}>
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2,6,23,0.5)', zIndex: 30 }}
        />
      )}

      {/* Sidebar */}
      <aside style={sidebarStyle}>
        {/* Brand header */}
        <div style={{ padding: '1rem', borderBottom: `1px solid ${THEME.shellBorder}` }}>
          <h1 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: THEME.shellText, lineHeight: 1.35 }}>
            {COMPANY_CONFIG.legalName}
          </h1>
          <p style={{ fontSize: '0.72rem', margin: '0.25rem 0 0', color: THEME.shellMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Driver Workspace
          </p>
          <div style={{ marginTop: '0.4rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: THEME.shellMuted }}>Role</span>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#1d4ed8', backgroundColor: '#dbeafe', padding: '0.1rem 0.4rem', borderRadius: '999px' }}>
              Driver
            </span>
            {personaLabel && (
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6d28d9', backgroundColor: '#ede9fe', padding: '0.1rem 0.4rem', borderRadius: '999px' }}>
                {personaLabel}
              </span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '0.5rem', overflowY: 'auto' }}>
          {NAV_GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: '0.6rem' }}>
              <div style={{ fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: THEME.shellMuted, padding: '0.3rem 0.65rem 0.2rem' }}>
                {group.label}
              </div>
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      router.push(item.href);
                      if (isMobile) setSidebarOpen(false);
                    }}
                    style={navButtonStyle(active)}
                  >
                    <span style={iconBoxStyle(active)}>{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '0.8rem', borderTop: `1px solid ${THEME.shellBorder}` }}>
          {availabilityLabel && (
            <div style={{ fontSize: '0.68rem', marginBottom: '0.3rem' }}>
              <span style={{ color: THEME.shellMuted }}>Status: </span>
              <span style={{ fontWeight: 600, color: '#15803d' }}>{availabilityLabel}</span>
            </div>
          )}
          <div style={{ fontSize: '0.72rem', color: THEME.shellMuted, marginBottom: '0.15rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {displayName}
          </div>
          <div style={{ fontSize: '0.7rem', color: THEME.shellMuted, marginBottom: '0.5rem', wordBreak: 'break-word' }}>
            {displayEmail}
          </div>
          <button
            onClick={logout}
            style={{
              width: '100%',
              padding: '0.45rem',
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0, padding: isMobile ? '0.9rem' : '1.25rem', display: 'flex', flexDirection: 'column' }}>
        {/* Mobile menu toggle */}
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              alignSelf: 'flex-start',
              padding: '0.45rem 0.7rem',
              borderRadius: '8px',
              border: `1px solid ${THEME.cardBorder}`,
              backgroundColor: '#ffffff',
              color: THEME.shellText,
              fontWeight: 700,
              marginBottom: '0.8rem',
              cursor: 'pointer',
              fontSize: '0.82rem',
            }}
          >
            ☰ Menu
          </button>
        )}

        {/* Page header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Driver Workspace
            </div>
            {subtitle && (
              <p style={{ color: '#475569', margin: 0, maxWidth: '780px', fontSize: '0.85rem', lineHeight: 1.55 }}>
                {subtitle}
              </p>
            )}
          </div>
          {headerActions && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {headerActions}
            </div>
          )}
        </div>

        {/* Page body */}
        {children}
      </main>
    </div>
  );
}
