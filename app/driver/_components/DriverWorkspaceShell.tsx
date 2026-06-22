'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import { COMPANY_CONFIG } from '../../config/company';
import {
  DRIVER_WORKSPACE_MODE_LABELS,
  resolveDriverWorkspaceMode,
} from '../../../lib/driverWorkspaceMode';
import { getDriverWorkspaceCapabilities, type RoleCapabilities } from '../../../lib/roleCapabilities';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';

const THEME = {
  pageBg: '#eef2f6',
  shellBg: '#111827',
  shellBorder: '#1f2937',
  shellMuted: '#9ca3af',
  shellText: '#f9fafb',
  cardBg: '#ffffff',
  cardBorder: '#d7e0ea',
  cardShadow: '0 6px 16px rgba(15, 23, 42, 0.08)',
  radius: '10px',
  live: '#1d4ed8',
};

type NavItem = {
  id: string;
  label: string;
  icon: string;
  href: string;
  exact?: boolean;
};

const NAV_ITEM_CAPABILITIES: Partial<Record<string, keyof RoleCapabilities>> = {
  loads: 'canViewExchangeLoads',
  'load-search': 'canViewExchangeLoads',
  quotes: 'canQuoteLoads',
  'won-work': 'canExecuteJobs',
  finance: 'canViewInvoices',
  vehicles: 'canManageOwnVehicle',
  returns: 'canUseReturnJourneys',
  'business-admin': 'canManageCompanyUsers',
};

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📋', href: '/driver/jobs' },
  { id: 'loads', label: 'Loads', icon: '🚚', href: '/driver/loads', exact: true },
  { id: 'load-search', label: 'Search Loads', icon: '🔎', href: '/driver/loads/search', exact: true },
  { id: 'quotes', label: 'Quotes', icon: '💬', href: '/driver/quotes' },
  { id: 'won-work', label: 'Won Work', icon: '🏆', href: '/driver/won-work' },
  { id: 'history', label: 'Diary', icon: '📚', href: '/driver/history' },
  { id: 'finance', label: 'Invoices', icon: '💷', href: '/driver/finance' },
  { id: 'availability', label: 'Availability', icon: '📅', href: '/driver/availability' },
  { id: 'vehicles', label: 'Vehicles', icon: '🚛', href: '/driver/vehicles' },
  { id: 'documents', label: 'Documents', icon: '🗂️', href: '/driver/documents' },
  { id: 'profile', label: 'Profile', icon: '👤', href: '/driver/profile' },
  { id: 'returns', label: 'Return Journeys', icon: '↩️', href: '/driver/returns' },
  { id: 'security', label: 'Security', icon: '🔐', href: '/driver/change-password' },
];

const BUSINESS_NAV_ITEM: NavItem = {
  id: 'business-admin',
  label: 'Business Admin',
  icon: 'B',
  href: '/admin',
  exact: true,
};

interface DriverWorkspaceShellProps {
  children: ReactNode;
  subtitle?: string;
  headerActions?: ReactNode;
  driverName?: string;
  availabilityLabel?: string;
  personaLabel?: string;
}

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
  const [unreadCount, setUnreadCount] = useState(0);
  const workspaceMode = resolveDriverWorkspaceMode(user);
  const capabilities = getDriverWorkspaceCapabilities(workspaceMode);
  const visibleNavItems = (workspaceMode === 'admin_business' ? [...NAV_ITEMS, BUSINESS_NAV_ITEM] : NAV_ITEMS).filter(
    (item) => {
      const capability = NAV_ITEM_CAPABILITIES[item.id];
      return !capability || capabilities[capability];
    }
  );

  useEffect(() => {
    setHydrated(true);
    const update = () => setIsMobile(window.innerWidth <= 1024);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Poll unread notification count every 60 s
  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id) return;
    const fetchCount = async () => {
      const { count } = await supabase
        .from('notification_events')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_user_id', user.id)
        .eq('status', 'pending');
      setUnreadCount(count ?? 0);
    };
    void fetchCount();
    const interval = setInterval(() => { void fetchCount(); }, 60_000);
    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    if (!isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const displayName = driverName ?? user?.email ?? 'Driver';
  const displayEmail = user?.email ?? '';

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + '/');
  };

  if (!hydrated) {
    return <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg }} />;
  }

  const sidebarStyle: CSSProperties = {
    width: isMobile ? '270px' : '236px',
    backgroundColor: THEME.shellBg,
    color: '#ffffff',
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
    padding: '0.55rem 0.65rem',
    backgroundColor: active ? 'rgba(255,255,255,0.14)' : 'transparent',
    color: active ? '#ffffff' : THEME.shellMuted,
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
    fontWeight: active ? 700 : 500,
    borderRadius: '6px',
  });

  const iconBoxStyle = (active: boolean): CSSProperties => ({
    width: '22px',
    height: '22px',
    borderRadius: '6px',
    display: 'grid',
    placeItems: 'center',
    fontSize: '0.85rem',
    backgroundColor: active ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)',
    flexShrink: 0,
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: THEME.pageBg }}>
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2,6,23,0.5)', zIndex: 30 }}
        />
      )}

      <aside style={sidebarStyle}>
        <div style={{ padding: '1rem', borderBottom: `1px solid ${THEME.shellBorder}` }}>
          <h1 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: THEME.shellText, lineHeight: 1.35 }}>
            {COMPANY_CONFIG.legalName}
          </h1>
          <p style={{ fontSize: '0.72rem', margin: '0.25rem 0 0', color: THEME.shellMuted, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            Driver Exchange
            {unreadCount > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '18px', height: '18px', background: '#ef4444', color: '#fff', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700, padding: '0 4px' }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </p>
          <div style={{ marginTop: '0.4rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: THEME.shellMuted }}>Role</span>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#93c5fd', backgroundColor: 'rgba(59,130,246,0.2)', padding: '0.1rem 0.4rem', borderRadius: '999px' }}>
              {DRIVER_WORKSPACE_MODE_LABELS[workspaceMode]}
            </span>
            {personaLabel && (
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#c4b5fd', backgroundColor: 'rgba(109,40,217,0.3)', padding: '0.1rem 0.4rem', borderRadius: '999px' }}>
                {personaLabel}
              </span>
            )}
          </div>
        </div>

        <nav style={{ flex: 1, padding: '0.5rem', overflowY: 'auto' }}>
          {visibleNavItems.map((item) => {
            const active = isActive(item);
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
        </nav>

        <div style={{ padding: '0.8rem', borderTop: `1px solid ${THEME.shellBorder}` }}>
          {availabilityLabel && (
            <div style={{ fontSize: '0.68rem', marginBottom: '0.3rem' }}>
              <span style={{ color: THEME.shellMuted }}>Status: </span>
              <span style={{ fontWeight: 600, color: '#86efac' }}>{availabilityLabel}</span>
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
              backgroundColor: 'rgba(239,68,68,0.15)',
              color: '#fca5a5',
              border: '1px solid rgba(239,68,68,0.3)',
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

      <main style={{ flex: 1, minWidth: 0, padding: isMobile ? '0.9rem' : '1.25rem', display: 'flex', flexDirection: 'column' }}>
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

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Driver Exchange
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

        {children}
      </main>
    </div>
  );
}
