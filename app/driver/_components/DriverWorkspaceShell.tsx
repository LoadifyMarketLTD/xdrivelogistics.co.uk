'use client';

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Briefcase, FileText, Home, Lock, MessageCircle, MoreHorizontal, PackageSearch, UserCircle } from 'lucide-react';
import { useAuth } from '../../components/AuthContext';
import { DRIVER_WORKSPACE_MODE_LABELS, resolveDriverWorkspaceMode } from '../../../lib/driverWorkspaceMode';
import { getDriverWorkspaceCapabilities, type RoleCapabilities } from '../../../lib/roleCapabilities';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';

type NavItem = {
  id: 'home' | 'loads' | 'quotes' | 'jobs' | 'more';
  label: string;
  href: string;
  capability?: keyof RoleCapabilities;
  icon: typeof Home;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', href: '/driver/jobs', capability: 'canExecuteJobs', icon: Home },
  { id: 'loads', label: 'Loads', href: '/driver/loads', capability: 'canViewExchangeLoads', icon: PackageSearch },
  { id: 'quotes', label: 'Quotes', href: '/driver/quotes', capability: 'canQuoteLoads', icon: MessageCircle },
  { id: 'jobs', label: 'Jobs', href: '/driver/won-work', capability: 'canExecuteJobs', icon: Briefcase },
  { id: 'more', label: 'More', href: '/driver/more', icon: MoreHorizontal },
];

const MORE_LINKS = [
  { href: '/driver/documents', label: 'Documents', icon: FileText },
  { href: '/driver/profile', label: 'Profile', icon: UserCircle },
  { href: '/driver/change-password', label: 'Password', icon: Lock },
];

interface DriverWorkspaceShellProps {
  children: ReactNode;
  subtitle?: string;
  headerActions?: ReactNode;
  driverName?: string;
  availabilityLabel?: string;
  personaLabel?: string;
}

const pageStyle: CSSProperties = {
  minHeight: '100dvh',
  background: '#07111f',
  color: '#f8fafc',
};

const appFrameStyle: CSSProperties = {
  minHeight: '100dvh',
  maxWidth: '560px',
  margin: '0 auto',
  background: '#0b1524',
  position: 'relative',
  boxShadow: '0 0 0 1px rgba(255,255,255,0.06)',
};

export default function DriverWorkspaceShell({ children, headerActions, driverName, availabilityLabel, personaLabel }: DriverWorkspaceShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [hydrated, setHydrated] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const workspaceMode = resolveDriverWorkspaceMode(user);
  const capabilities = getDriverWorkspaceCapabilities(workspaceMode);

  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => !item.capability || capabilities[item.capability]),
    [capabilities]
  );

  useEffect(() => setHydrated(true), []);

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
    const interval = window.setInterval(() => { void fetchCount(); }, 60_000);
    return () => window.clearInterval(interval);
  }, [user?.id]);

  const activeItem = (item: NavItem) => {
    if (item.id === 'home') return pathname === item.href;
    if (item.id === 'jobs') return pathname === item.href || pathname.startsWith('/driver/jobs/');
    if (item.id === 'more') return pathname === item.href || MORE_LINKS.some((link) => pathname === link.href || pathname.startsWith(`${link.href}/`));
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  if (!hydrated) return <div style={pageStyle} />;

  return (
    <div style={pageStyle}>
      <div style={appFrameStyle}>
        <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(11,21,36,0.96)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.15rem' }}>
                <span style={{ color: '#facc15', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>XDrive</span>
                <span style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 700 }}>{DRIVER_WORKSPACE_MODE_LABELS[workspaceMode]}</span>
                {unreadCount > 0 && <span style={{ background: '#ef4444', color: '#fff', minWidth: '18px', height: '18px', borderRadius: '999px', display: 'inline-grid', placeItems: 'center', fontSize: '0.65rem', fontWeight: 800 }}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </div>
              <div style={{ color: '#f8fafc', fontWeight: 800, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {driverName ?? user?.email ?? 'Driver'}
              </div>
            </div>
            {(availabilityLabel || personaLabel || headerActions) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {availabilityLabel && <span style={{ color: '#86efac', background: 'rgba(22,163,74,0.16)', border: '1px solid rgba(134,239,172,0.25)', borderRadius: '999px', padding: '0.25rem 0.55rem', fontSize: '0.72rem', fontWeight: 800 }}>{availabilityLabel}</span>}
                {personaLabel && <span style={{ color: '#fde68a', background: 'rgba(250,204,21,0.12)', borderRadius: '999px', padding: '0.25rem 0.55rem', fontSize: '0.72rem', fontWeight: 800 }}>{personaLabel}</span>}
                {headerActions}
              </div>
            )}
          </div>
        </header>

        <main style={{ padding: '0.9rem 0.9rem 5.75rem' }}>{children}</main>

        <nav style={{ position: 'fixed', left: '50%', bottom: 0, transform: 'translateX(-50%)', width: '100%', maxWidth: '560px', background: 'rgba(7,17,31,0.98)', borderTop: '1px solid rgba(255,255,255,0.1)', padding: '0.45rem 0.45rem calc(0.45rem + env(safe-area-inset-bottom))', display: 'grid', gridTemplateColumns: `repeat(${visibleNavItems.length}, minmax(0, 1fr))`, gap: '0.25rem', zIndex: 30 }}>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = activeItem(item);
            return (
              <button
                key={item.id}
                onClick={() => router.push(item.href)}
                aria-current={active ? 'page' : undefined}
                style={{ minHeight: '52px', border: 'none', borderRadius: '14px', background: active ? 'rgba(250,204,21,0.16)' : 'transparent', color: active ? '#facc15' : '#94a3b8', display: 'grid', placeItems: 'center', gap: '0.15rem', fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer' }}
              >
                <Icon size={20} strokeWidth={2.5} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
