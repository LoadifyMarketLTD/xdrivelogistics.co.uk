'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthContext';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import type { AppUserRole } from '../../lib/authRole';
import { getCapabilitiesForRole } from '../../lib/roleCapabilities';
import { getNavSectionsForRole } from './workflowUi';

/** Shorter labels for the compact top nav bar */
const SHORT_LABEL: Record<string, string> = {
  marketplace: 'LOADS',
  quotes: 'QUOTES',
  bids: 'BIDS',
  diary: 'DIARY',
  jobs: 'JOBS',
  disputes: 'DISPUTES',
  fleet: 'FLEET',
  drivers: 'DRIVERS',
  vehicles: 'VEHICLES',
  documents: 'DOCS',
  invoices: 'INVOICES',
  companies: 'COMPANIES',
  dispatchers: 'MEMBERS',
  settings: 'SETTINGS',
};

export default function AdminPlatformShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const role = (user?.role ?? null) as AppUserRole | null;
  const sections = getNavSectionsForRole(role, {
    membershipRole: user?.membershipRole ?? null,
    financeAccess: user?.financeAccess ?? null,
    ownerDriverWorkspace: user?.ownerDriverWorkspace === true,
  });
  const capabilities = getCapabilitiesForRole(role, {
    membershipRole: user?.membershipRole ?? null,
    financeAccess: user?.financeAccess ?? null,
    ownerDriverWorkspace: user?.ownerDriverWorkspace === true,
  });
  const canOpenSettings = sections.some((section) => section.items.some((item) => item.href === '/admin/settings'));

  // All nav items except the Platform Home entry (logo acts as Home button)
  const navItems = sections.flatMap((s) => s.items).filter((item) => item.href !== '/admin');

  useEffect(() => {
    if (!user?.companyId || !isSupabaseConfigured) return;
    let cancelled = false;
    supabase
      .from('companies')
      .select('name')
      .eq('id', user.companyId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.name) setCompanyName(data.name as string);
      });
    return () => { cancelled = true; };
  }, [user?.companyId]);

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

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', display: 'flex', flexDirection: 'column' }}>

      {/* ── Sticky top navigation (CX-style) ────────────────────────────── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>

        {/* Row 1 — Brand bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.25rem', height: '52px', gap: '1rem' }}>

          {/* Logo + company name */}
          <button
            onClick={() => router.push('/admin')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
          >
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 900, fontSize: '1rem', letterSpacing: '-1px', fontFamily: 'sans-serif' }}>X</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a', whiteSpace: 'nowrap' }}>
              {companyName ?? 'XDrive Logistics'}
            </span>
          </button>

          {/* Right — primary action + user controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexShrink: 0 }}>
            {capabilities.canPostLoads && (
              <button
                onClick={() => router.push('/admin/marketplace')}
                style={{ background: '#15803d', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.38rem 0.9rem', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '0.02em' }}
              >
                + POST LOAD
              </button>
            )}
            {user?.email && (
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email}
              </span>
            )}
            {unreadCount > 0 && (
              <span title={`${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '20px', height: '20px', background: '#ef4444', color: '#fff', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700, padding: '0 4px', cursor: 'default' }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
            {canOpenSettings && (
              <button
                onClick={() => router.push('/admin/settings')}
                title="Settings"
                style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.3rem 0.5rem', cursor: 'pointer', color: '#64748b', fontSize: '0.85rem', lineHeight: 1 }}
              >
                ⚙
              </button>
            )}
            <button
              onClick={() => void logout()}
              style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.3rem 0.65rem', cursor: 'pointer', color: '#64748b', fontSize: '0.72rem', fontWeight: 600 }}
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Row 2 — Module tab bar */}
        <nav style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', scrollbarWidth: 'none', borderTop: '1px solid #f1f5f9', padding: '0 1rem', gap: 0 }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href + '/'));
            const label = SHORT_LABEL[item.id] ?? item.label.toUpperCase();
            return (
              <button
                key={item.id}
                onClick={() => router.push(item.href)}
                style={{
                  padding: '0.6rem 0.85rem',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #1d4ed8' : '2px solid transparent',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: isActive ? '#1d4ed8' : '#64748b',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  marginBottom: '-1px',
                  transition: 'color 0.12s',
                }}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Page content ────────────────────────────────────────────────── */}
      <div style={{ flex: 1 }}>
        {children}
      </div>

    </div>
  );
}
