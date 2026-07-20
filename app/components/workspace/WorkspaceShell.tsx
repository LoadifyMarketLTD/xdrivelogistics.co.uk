'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../AuthContext';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import { getVisibleWorkspaceNav, getWorkspaceDefinition, hasWorkspaceCapability, resolveWorkspaceRole, type WorkspaceRole } from '../../../lib/workspaceRole';
import { workspaceTheme } from './WorkspaceUI';

export default function WorkspaceShell({ children, forcedRole }: { children: ReactNode; forcedRole?: WorkspaceRole }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [companyName, setCompanyName] = useState('XDrive Logistics');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const role = forcedRole ?? resolveWorkspaceRole(user);
  const definition = getWorkspaceDefinition(role);
  const nav = useMemo(() => getVisibleWorkspaceNav(role), [role]);

  useEffect(() => { setHydrated(true); const update = () => setIsCompact(window.innerWidth <= 1050); update(); window.addEventListener('resize', update); return () => window.removeEventListener('resize', update); }, []);
  useEffect(() => {
    if (!user?.companyId || !isSupabaseConfigured) { if (role === 'customer') setCompanyName('Customer Account'); else if (role === 'broker') setCompanyName('Broker Company'); else if (role === 'driver' || role === 'owner_driver') setCompanyName(user?.email ?? 'Driver Account'); return; }
    let cancelled = false;
    void supabase.from('companies').select('name').eq('id', user.companyId).maybeSingle().then(({ data }) => { if (!cancelled && typeof data?.name === 'string' && data.name.trim()) setCompanyName(data.name); });
    return () => { cancelled = true; };
  }, [role, user?.companyId, user?.email]);
  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured) return;
    const fetchUnread = async () => { const { count } = await supabase.from('notification_events').select('id', { count: 'exact', head: true }).eq('recipient_user_id', user.id).in('status', ['pending', 'failed']); setUnreadCount(count ?? 0); };
    void fetchUnread(); const timer = window.setInterval(() => void fetchUnread(), 60000); return () => window.clearInterval(timer);
  }, [user?.id]);
  useEffect(() => { if (!isCompact) setSidebarOpen(false); }, [isCompact]);

  const isActive = (href: string) => { const [baseHref] = href.split('?'); if (baseHref === definition.homeHref) return pathname === baseHref; return pathname === baseHref || pathname.startsWith(`${baseHref}/`); };
  const primaryAction = definition.primaryAction && (!definition.primaryAction.capability || hasWorkspaceCapability(role, definition.primaryAction.capability)) ? definition.primaryAction : null;
  const notificationsHref = role === 'broker' ? '/broker/notifications' : role === 'customer' ? '/customer/notifications' : role === 'driver' || role === 'owner_driver' ? '/driver/notifications' : '/admin/notifications';
  if (!hydrated) return <div style={{ minHeight: '100vh', background: workspaceTheme.page }} />;

  const sidebarStyle: CSSProperties = { width: isCompact ? 292 : 258, background: '#f8fafc', borderRight: `1px solid ${workspaceTheme.border}`, display: 'flex', flexDirection: 'column', height: '100vh', position: isCompact ? 'fixed' : 'sticky', top: 0, left: 0, zIndex: 60, flexShrink: 0, transform: isCompact ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none', transition: 'transform 0.2s ease' };
  return <div style={{ display: 'flex', minHeight: '100vh', background: workspaceTheme.page, color: workspaceTheme.text }}>
    {isCompact && sidebarOpen && <button aria-label="Close menu" onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, border: 0, background: 'rgba(15,23,42,0.55)', zIndex: 50, cursor: 'pointer' }} />}
    <aside style={sidebarStyle}>
      <div style={{ padding: '0.82rem', background: '#fff', borderBottom: `1px solid ${workspaceTheme.border}` }}>
        <button onClick={() => router.push(definition.homeHref)} style={{ border: 0, background: 'transparent', padding: 0, width: '100%', cursor: 'pointer', textAlign: 'left' }}><div style={{ display: 'flex', gap: '0.58rem', alignItems: 'center' }}><div style={{ width: 34, height: 34, borderRadius: 9, background: workspaceTheme.navy, display: 'grid', placeItems: 'center' }}><span style={{ color: workspaceTheme.orange, fontWeight: 950 }}>X</span></div><div style={{ minWidth: 0 }}><div style={{ color: workspaceTheme.text, fontSize: '0.82rem', fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{companyName}</div><div style={{ color: workspaceTheme.muted, fontSize: '0.64rem', marginTop: '0.1rem' }}>{definition.subtitle}</div></div></div></button>
        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.6rem', flexWrap: 'wrap' }}><span style={{ fontSize: '0.61rem', fontWeight: 850, textTransform: 'uppercase', color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', padding: '0.2rem 0.42rem', borderRadius: 999 }}>{definition.label}</span>{!['driver', 'customer', 'broker', 'owner_driver'].includes(role) && <span style={{ fontSize: '0.61rem', fontWeight: 800, color: '#1e40af', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '0.2rem 0.42rem', borderRadius: 999 }}>Company View</span>}</div>
      </div>
      <nav style={{ flex: 1, overflowY: 'auto', padding: '0.52rem' }}>{nav.map(group => <div key={group.id} style={{ marginBottom: '0.45rem' }}><div style={{ padding: '0.27rem 0.45rem 0.2rem', color: '#64748b', fontSize: '0.61rem', fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{group.label}</div><div style={{ display: 'grid', gap: '0.12rem' }}>{group.items.map(item => { const active = isActive(item.href); return <button key={item.id} onClick={() => { router.push(item.href); if (isCompact) setSidebarOpen(false); }} style={{ width: '100%', display: 'grid', gridTemplateColumns: '23px minmax(0,1fr) 8px', alignItems: 'center', gap: '0.35rem', border: 0, borderLeft: active ? `3px solid ${workspaceTheme.blue}` : '3px solid transparent', borderRadius: 8, background: active ? '#eff6ff' : 'transparent', color: active ? workspaceTheme.blue : workspaceTheme.text, padding: '0.43rem 0.48rem', fontSize: '0.73rem', fontWeight: active ? 850 : 650, textAlign: 'left', cursor: 'pointer' }}><span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 7, display: 'grid', placeItems: 'center', background: active ? '#dbeafe' : '#eef2f6', color: active ? workspaceTheme.blue : '#475569', fontSize: item.icon === 'OC' ? '0.55rem' : '0.72rem', fontWeight: 900 }}>{item.icon ?? '•'}</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>{active ? <span style={{ width: 6, height: 6, borderRadius: '50%', background: workspaceTheme.blue }} /> : <span />}</button>; })}</div></div>)}</nav>
      <div style={{ padding: '0.72rem', borderTop: `1px solid ${workspaceTheme.border}`, background: '#fff' }}><div style={{ color: workspaceTheme.muted, fontSize: '0.66rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.5rem' }}>{user?.email ?? ''}</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.38rem' }}><button onClick={() => router.push(definition.homeHref)} style={{ border: `1px solid ${workspaceTheme.border}`, borderRadius: 8, background: '#fff', padding: '0.43rem', fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer' }}>Home</button><button onClick={() => void logout()} style={{ border: '1px solid #fecaca', borderRadius: 8, background: '#fef2f2', color: workspaceTheme.red, padding: '0.43rem', fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer' }}>Sign out</button></div></div>
    </aside>
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}><header style={{ minHeight: 58, background: '#fff', borderBottom: `1px solid ${workspaceTheme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.62rem clamp(0.8rem,2vw,1.3rem)', position: 'sticky', top: 0, zIndex: 35, gap: '0.8rem' }}><div style={{ display: 'flex', alignItems: 'center', gap: '0.62rem', minWidth: 0 }}>{isCompact && <button onClick={() => setSidebarOpen(true)} style={{ width: 38, height: 38, border: `1px solid ${workspaceTheme.border}`, borderRadius: 9, background: '#fff', fontSize: '1rem', fontWeight: 900, cursor: 'pointer' }}>☰</button>}<div style={{ minWidth: 0 }}><div style={{ fontSize: '0.7rem', color: workspaceTheme.muted, fontWeight: 750 }}>{definition.label}</div><div style={{ fontSize: '0.82rem', color: workspaceTheme.text, fontWeight: 850, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{companyName}</div></div></div><div style={{ display: 'flex', alignItems: 'center', gap: '0.48rem' }}>{primaryAction && <button onClick={() => router.push(primaryAction.href)} style={{ border: 0, background: workspaceTheme.green, color: '#fff', padding: '0.52rem 0.8rem', borderRadius: 8, fontSize: '0.72rem', fontWeight: 850, cursor: 'pointer' }}>+ {primaryAction.label}</button>}<button onClick={() => router.push(notificationsHref)} title="Notifications" style={{ position: 'relative', width: 38, height: 38, border: `1px solid ${workspaceTheme.border}`, borderRadius: '50%', background: '#fff', cursor: 'pointer' }}>🔔{unreadCount > 0 && <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 17, height: 17, padding: '0 3px', borderRadius: 999, background: workspaceTheme.red, color: '#fff', display: 'grid', placeItems: 'center', fontSize: '0.58rem', fontWeight: 900 }}>{unreadCount > 99 ? '99+' : unreadCount}</span>}</button></div></header><main style={{ flex: 1, minWidth: 0 }}>{children}</main></div>
    <style jsx global>{`@media (max-width: 820px){.xdrive-two-column{grid-template-columns:1fr!important;}}`}</style>
  </div>;
}
