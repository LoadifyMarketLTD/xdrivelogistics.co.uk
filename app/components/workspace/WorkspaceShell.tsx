'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../AuthContext';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import {
  getVisibleWorkspaceNav,
  getWorkspaceDefinition,
  hasWorkspaceCapability,
  resolveWorkspaceRole,
  type WorkspaceRole,
} from '../../../lib/workspaceRole';
import { workspaceTheme } from './WorkspaceUI';

export default function WorkspaceShell({
  children,
  forcedRole,
}: {
  children: ReactNode;
  forcedRole?: WorkspaceRole;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [companyName, setCompanyName] = useState<string>('XDrive Logistics');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  const role = forcedRole ?? resolveWorkspaceRole(user);
  const definition = getWorkspaceDefinition(role);
  const nav = useMemo(() => getVisibleWorkspaceNav(role), [role]);

  useEffect(() => {
    setHydrated(true);
    const update = () => setIsCompact(window.innerWidth <= 1050);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (!user?.companyId || !isSupabaseConfigured) {
      if (role === 'customer') setCompanyName('Customer Account');
      else if (role === 'broker') setCompanyName('Broker Company');
      else if (role === 'driver' || role === 'owner_driver') setCompanyName(user?.email ?? 'Driver Account');
      return;
    }
    let cancelled = false;
    supabase
      .from('companies')
      .select('name')
      .eq('id', user.companyId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && typeof data?.name === 'string' && data.name.trim()) setCompanyName(data.name);
      });
    return () => { cancelled = true; };
  }, [role, user?.companyId, user?.email]);

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured) return;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('notification_events')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_user_id', user.id)
        .in('status', ['pending', 'failed']);
      setUnreadCount(count ?? 0);
    };
    void fetchUnread();
    const timer = window.setInterval(() => void fetchUnread(), 60_000);
    return () => window.clearInterval(timer);
  }, [user?.id]);

  useEffect(() => {
    if (!isCompact) setSidebarOpen(false);
  }, [isCompact]);

  const isActive = (href: string) => {
    const [baseHref] = href.split('?');
    if (baseHref === definition.homeHref) return pathname === baseHref;
    return pathname === baseHref || pathname.startsWith(`${baseHref}/`);
  };

  const primaryAction = definition.primaryAction && (!definition.primaryAction.capability || hasWorkspaceCapability(role, definition.primaryAction.capability))
    ? definition.primaryAction
    : null;

  const notificationsHref = role === 'broker'
    ? '/broker/notifications'
    : role === 'customer'
      ? '/customer/notifications'
      : role === 'driver' || role === 'owner_driver'
        ? '/driver/notifications'
        : '/admin/notifications';

  if (!hydrated) return <div style={{ minHeight: '100vh', background: workspaceTheme.page }} />;

  const sidebarStyle: CSSProperties = {
    width: isCompact ? '292px' : '252px',
    background: '#f8fafc',
    borderRight: `1px solid ${workspaceTheme.border}`,
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    position: isCompact ? 'fixed' : 'sticky',
    top: 0,
    left: 0,
    zIndex: 60,
    flexShrink: 0,
    transform: isCompact ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
    transition: 'transform 0.2s ease',
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: workspaceTheme.page, color: workspaceTheme.text }}>
      {isCompact && sidebarOpen && <button aria-label="Close menu" onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, border: 0, background: 'rgba(15,23,42,0.55)', zIndex: 50, cursor: 'pointer' }} />}

      <aside style={sidebarStyle} aria-label={`${definition.label} navigation`}>
        <div style={{ padding: '0.75rem', background: '#fff', borderBottom: `1px solid ${workspaceTheme.border}` }}>
          <button onClick={() => router.push(definition.homeHref)} style={{ border: 0, background: 'transparent', padding: 0, width: '100%', cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'center' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: workspaceTheme.navy, display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(11,47,107,0.18)' }}>
                <span style={{ color: workspaceTheme.orange, fontWeight: 950, fontSize: '1rem' }}>X</span>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: workspaceTheme.text, fontSize: '0.8rem', fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{companyName}</div>
                <div style={{ color: workspaceTheme.muted, fontSize: '0.62rem', marginTop: '0.08rem' }}>{definition.subtitle}</div>
              </div>
            </div>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.32rem', marginTop: '0.55rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.59rem', fontWeight: 850, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', padding: '0.18rem 0.4rem', borderRadius: '999px' }}>{definition.label}</span>
            {role !== 'driver' && role !== 'customer' && role !== 'broker' && role !== 'owner_driver' && (
              <span style={{ fontSize: '0.59rem', fontWeight: 800, color: '#1e40af', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '0.18rem 0.4rem', borderRadius: '999px' }}>Company View</span>
            )}
          </div>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', padding: '0.48rem' }}>
          {nav.map((group) => (
            <div key={group.id} style={{ marginBottom: '0.42rem' }}>
              <div style={{ padding: '0.25rem 0.42rem 0.18rem', color: '#64748b', fontSize: '0.58rem', fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{group.label}</div>
              <div style={{ display: 'grid', gap: '0.1rem' }}>
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <button
                      key={item.id}
                      onClick={() => { router.push(item.href); if (isCompact) setSidebarOpen(false); }}
                      style={{
                        width: '100%',
                        display: 'grid',
                        gridTemplateColumns: '22px minmax(0,1fr) 7px',
                        alignItems: 'center',
                        gap: '0.34rem',
                        border: 0,
                        borderLeft: active ? `3px solid ${workspaceTheme.blue}` : '3px solid transparent',
                        borderRadius: '7px',
                        background: active ? '#eff6ff' : 'transparent',
                        color: active ? workspaceTheme.blue : workspaceTheme.text,
                        padding: '0.4rem 0.45rem',
                        fontSize: '0.7rem',
                        fontWeight: active ? 850 : 650,
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span aria-hidden="true" style={{ width: '21px', height: '21px', borderRadius: '6px', display: 'grid', placeItems: 'center', background: active ? '#dbeafe' : '#eef2f6', color: active ? workspaceTheme.blue : '#475569', fontSize: item.icon === 'OC' ? '0.52rem' : '0.68rem', fontWeight: 900 }}>{item.icon ?? '•'}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                      {active ? <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: workspaceTheme.blue }} /> : <span />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div style={{ padding: '0.65rem', borderTop: `1px solid ${workspaceTheme.border}`, background: '#fff' }}>
          <div style={{ color: workspaceTheme.muted, fontSize: '0.63rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.45rem' }}>{user?.email ?? ''}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.34rem' }}>
            <button onClick={() => router.push(definition.homeHref)} style={{ border: `1px solid ${workspaceTheme.border}`, borderRadius: '7px', background: '#fff', color: workspaceTheme.text, padding: '0.4rem', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer' }}>Home</button>
            <button onClick={() => void logout()} style={{ border: '1px solid #fecaca', borderRadius: '7px', background: '#fff', color: workspaceTheme.red, padding: '0.4rem', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer' }}>Sign out</button>
          </div>
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{ minHeight: '56px', background: '#fff', borderBottom: `1px solid ${workspaceTheme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.56rem clamp(0.75rem,2vw,1.2rem)', position: 'sticky', top: 0, zIndex: 35, gap: '0.75rem', boxShadow: '0 1px 5px rgba(15,23,42,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.58rem', minWidth: 0 }}>
            {isCompact && <button aria-label="Open menu" onClick={() => setSidebarOpen(true)} style={{ width: '36px', height: '36px', border: `1px solid ${workspaceTheme.border}`, borderRadius: '8px', background: '#fff', color: workspaceTheme.text, fontSize: '0.95rem', fontWeight: 900, cursor: 'pointer' }}>☰</button>}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.65rem', color: workspaceTheme.muted, fontWeight: 750 }}>{definition.label}</div>
              <div style={{ fontSize: '0.78rem', color: workspaceTheme.text, fontWeight: 850, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{companyName}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.42rem', flexShrink: 0 }}>
            {primaryAction && <button onClick={() => router.push(primaryAction.href)} style={{ border: 0, background: workspaceTheme.orange, color: '#172033', padding: '0.48rem 0.72rem', borderRadius: '8px', fontSize: '0.69rem', fontWeight: 850, cursor: 'pointer', boxShadow: '0 2px 7px rgba(245,163,0,0.22)' }}>+ {primaryAction.label}</button>}
            <button onClick={() => router.push(notificationsHref)} title="Notifications" aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`} style={{ position: 'relative', width: '36px', height: '36px', border: `1px solid ${workspaceTheme.border}`, borderRadius: '50%', background: '#fff', cursor: 'pointer', fontSize: '0.9rem' }}>
              🔔
              {unreadCount > 0 && <span style={{ position: 'absolute', top: '-4px', right: '-4px', minWidth: '16px', height: '16px', padding: '0 3px', borderRadius: '999px', background: workspaceTheme.red, color: '#fff', display: 'grid', placeItems: 'center', fontSize: '0.55rem', fontWeight: 900 }}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>
          </div>
        </header>
        <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
      </div>

      <style jsx global>{`
        * { box-sizing: border-box; }
        body { background: ${workspaceTheme.page}; }
        button, input, select, textarea { font: inherit; }
        .xdrive-table-row:hover td { background: #fbfdff; }
        @media (max-width: 820px) {
          .xdrive-two-column, .xdrive-settings-layout { grid-template-columns: 1fr !important; }
          .xdrive-settings-layout > aside { position: static !important; display: flex; overflow-x: auto; gap: 0.25rem; }
          .xdrive-settings-layout > aside button { min-width: 155px; margin-bottom: 0 !important; }
        }
        @media (max-width: 560px) {
          .xdrive-page-frame { padding-left: 0.65rem !important; padding-right: 0.65rem !important; }
          .xdrive-page-header { margin-bottom: 0.75rem !important; }
          .xdrive-kpi-grid { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
        }
      `}</style>
    </div>
  );
}
