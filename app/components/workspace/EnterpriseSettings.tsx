'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../AuthContext';
import { hasWorkspaceCapability, resolveWorkspaceRole, type WorkspaceCapability, type WorkspaceRole } from '../../../lib/workspaceRole';

const theme = { page: '#f4f6f8', surface: '#ffffff', soft: '#f8fafc', border: '#d7e0ea', borderStrong: '#c7d2df', text: '#0f172a', muted: '#64748b', blue: '#1d57d8', navy: '#0b2f6b', orange: '#f5a300', green: '#15803d', red: '#dc2626' };

export type SettingsItem = { id: string; label: string; href: string; description?: string; capability?: WorkspaceCapability; roles?: WorkspaceRole[] };
export type SettingsGroup = { id: string; label: string; items: SettingsItem[] };

const roleRoot = (role: WorkspaceRole) => role === 'customer' ? '/customer' : role === 'broker' ? '/broker' : role === 'driver' || role === 'owner_driver' ? '/driver' : role === 'platform_owner' ? '/super-admin' : '/admin';

const accountItems = (role: WorkspaceRole): SettingsItem[] => {
  const root = roleRoot(role);
  const driver = role === 'driver' || role === 'owner_driver';
  return [
    { id: 'company', label: 'Company', description: 'Identity, contact and registered details', href: role === 'customer' ? '/customer/settings' : role === 'broker' ? '/broker/settings' : driver ? '/driver/profile' : `${root}/settings`, capability: driver ? undefined : 'settings.manage', roles: driver ? ['owner_driver'] : undefined },
    { id: 'profile', label: 'User profile', description: 'Personal identity and contact details', href: driver ? '/driver/profile' : `${root}/settings?section=userProfile` },
  ];
};

const operationsItems = (role: WorkspaceRole): SettingsItem[] => {
  const driver = role === 'driver' || role === 'owner_driver';
  return [
    { id: 'members', label: 'Members / Team', description: 'Company membership and permissions', href: role === 'customer' ? '/customer/team' : role === 'broker' ? '/broker/settings?section=members' : '/admin/dispatchers', capability: 'company.members.manage' },
    { id: 'drivers', label: 'Drivers', description: 'Driver identity, contact and availability', href: driver ? '/driver/profile' : '/admin/drivers', capability: driver ? undefined : 'drivers.manage', roles: driver ? ['driver', 'owner_driver'] : undefined },
    { id: 'vehicles', label: 'Vehicles', description: 'Vehicle identity and operational records', href: driver ? '/driver/vehicles' : '/admin/vehicles', capability: 'vehicles.manage' },
  ];
};

const complianceCommercialItems = (_role: WorkspaceRole): SettingsItem[] => [];
const preferenceItems = (_role: WorkspaceRole): SettingsItem[] => [];

export const getEnterpriseSettingsGroups = (role: WorkspaceRole): SettingsGroup[] => {
  const groups: SettingsGroup[] = [
    { id: 'account', label: 'Account', items: accountItems(role) },
    { id: 'operations', label: 'People & vehicles', items: operationsItems(role) },
    { id: 'commercial', label: 'Compliance & billing', items: complianceCommercialItems(role) },
    { id: 'preferences', label: 'Preferences', items: preferenceItems(role) },
  ];
  return groups.map((group) => ({ ...group, items: group.items.filter((item) => (!item.roles || item.roles.includes(role)) && (!item.capability || hasWorkspaceCapability(role, item.capability))) })).filter((group) => group.items.length > 0);
};

const baseHref = (href: string) => href.split('?')[0];
const routeMatches = (pathname: string, href: string) => pathname === baseHref(href) || pathname.startsWith(`${baseHref(href)}/`);
export const isEnterpriseSettingsRoute = (pathname: string, role: WorkspaceRole) => getEnterpriseSettingsGroups(role).some((group) => group.items.some((item) => routeMatches(pathname, item.href)));

export function SettingsPageHeader({ title, description, actions, status }: { title: string; description?: string; actions?: ReactNode; status?: ReactNode }) {
  return <header style={{ marginBottom: '0.75rem' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.8rem', flexWrap: 'wrap' }}><div style={{ minWidth: 0, flex: '1 1 520px' }}><div style={{ color: theme.blue, fontSize: '0.64rem', fontWeight: 850, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Workspace settings</div><h1 style={{ margin: 0, color: theme.text, fontSize: 'clamp(1.3rem,2vw,1.75rem)', lineHeight: 1.15 }}>{title}</h1>{description && <p style={{ margin: '0.3rem 0 0', color: theme.muted, maxWidth: 860, fontSize: '0.79rem', lineHeight: 1.48 }}>{description}</p>}{status && <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>{status}</div>}</div>{actions && <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>{actions}</div>}</div></header>;
}

export function SettingsTopNav({ groups }: { groups: SettingsGroup[] }) {
  const pathname = usePathname(); const router = useRouter();
  return <nav aria-label="Settings modules" style={{ display: 'flex', gap: '0.2rem', overflowX: 'auto', background: '#fff', border: `1px solid ${theme.border}`, borderRadius: 9, padding: '0.3rem', marginBottom: '0.72rem' }}>{groups.flatMap((group) => group.items).map((item) => { const active = routeMatches(pathname, item.href); return <button key={item.id} type="button" onClick={() => router.push(item.href)} style={{ whiteSpace: 'nowrap', border: 0, borderBottom: `2px solid ${active ? theme.blue : 'transparent'}`, borderRadius: 6, background: active ? '#eff6ff' : 'transparent', color: active ? theme.blue : theme.text, padding: '0.46rem 0.58rem', fontSize: '0.67rem', fontWeight: active ? 850 : 700, cursor: 'pointer' }}>{item.label}</button>; })}</nav>;
}

export function SettingsSidebar({ groups }: { groups: SettingsGroup[] }) {
  const pathname = usePathname(); const router = useRouter();
  return <aside className="xdrive-enterprise-settings-sidebar" aria-label="Settings navigation" style={{ position: 'sticky', top: 70, alignSelf: 'start', background: '#fff', border: `1px solid ${theme.border}`, borderRadius: 9, padding: '0.42rem', maxHeight: 'calc(100vh - 88px)', overflowY: 'auto' }}>{groups.map((group) => <div key={group.id} style={{ marginBottom: '0.4rem' }}><div style={{ padding: '0.24rem 0.4rem', color: theme.muted, fontSize: '0.57rem', fontWeight: 850, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{group.label}</div>{group.items.map((item) => { const active = routeMatches(pathname, item.href); return <button key={item.id} type="button" onClick={() => router.push(item.href)} style={{ width: '100%', border: 0, borderLeft: `3px solid ${active ? theme.blue : 'transparent'}`, borderRadius: 7, background: active ? '#eff6ff' : 'transparent', color: active ? theme.blue : theme.text, textAlign: 'left', padding: '0.5rem 0.56rem', marginBottom: '0.1rem', cursor: 'pointer' }}><strong style={{ display: 'block', fontSize: '0.69rem' }}>{item.label}</strong>{item.description && <small style={{ display: 'block', color: theme.muted, fontSize: '0.6rem', lineHeight: 1.3, marginTop: '0.08rem' }}>{item.description}</small>}</button>; })}</div>)}</aside>;
}

export function SettingsLayout({ children, title = 'Settings', description = 'Manage the settings available to your current role and company workspace.', actions, status }: { children: ReactNode; title?: string; description?: string; actions?: ReactNode; status?: ReactNode }) {
  const { user } = useAuth(); const role = resolveWorkspaceRole(user); const groups = useMemo(() => getEnterpriseSettingsGroups(role), [role]);
  return <div className="xdrive-enterprise-settings-page" style={{ width: '100%', maxWidth: 1500, margin: '0 auto', padding: '1rem clamp(0.7rem,2vw,1.35rem) 2rem', background: theme.page }}><SettingsPageHeader title={title} description={description} actions={actions} status={status}/><SettingsTopNav groups={groups}/><div className="xdrive-enterprise-settings-layout" style={{ display: 'grid', gridTemplateColumns: '235px minmax(0,1fr)', gap: '0.75rem', alignItems: 'start' }}><SettingsSidebar groups={groups}/><main className="xdrive-enterprise-settings-content" style={{ minWidth: 0 }}>{children}</main></div><style jsx global>{`
    .xdrive-enterprise-settings-content > .xdrive-page-frame { padding: 0 !important; max-width: none !important; }
    .xdrive-enterprise-settings-content input,.xdrive-enterprise-settings-content select,.xdrive-enterprise-settings-content textarea{border-color:${theme.borderStrong}!important;border-radius:8px!important;box-shadow:none!important}
    .xdrive-enterprise-settings-content section{box-shadow:0 2px 8px rgba(15,23,42,.04)!important}
    @media(max-width:920px){.xdrive-enterprise-settings-layout{grid-template-columns:1fr!important}.xdrive-enterprise-settings-sidebar{position:static!important;display:flex;gap:.25rem;overflow-x:auto;max-height:none!important}.xdrive-enterprise-settings-sidebar>div{min-width:205px;margin-bottom:0!important}}
    @media(max-width:560px){.xdrive-enterprise-settings-page{padding-left:.58rem!important;padding-right:.58rem!important}}
  `}</style></div>;
}

export function EnterpriseSettingsBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname(); const { user } = useAuth(); const role = resolveWorkspaceRole(user);
  if (!isEnterpriseSettingsRoute(pathname, role)) return <>{children}</>;
  return <SettingsLayout>{children}</SettingsLayout>;
}

export function SettingsSection({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) { return <section style={{ background: '#fff', border: `1px solid ${theme.border}`, borderRadius: 9, overflow: 'hidden', marginBottom: '0.72rem' }}><div style={{ padding: '0.7rem 0.8rem', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap' }}><div><h2 style={{ margin: 0, fontSize: '0.87rem', color: theme.text }}>{title}</h2>{description && <p style={{ margin: '0.18rem 0 0', color: theme.muted, fontSize: '0.67rem', lineHeight: 1.42 }}>{description}</p>}</div>{actions}</div><div style={{ padding: '0.8rem' }}>{children}</div></section>; }
export function SettingsFormGrid({ children, columns = 2 }: { children: ReactNode; columns?: 1 | 2 | 3 }) { return <div className="xdrive-settings-form-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${columns},minmax(0,1fr))`, gap: '0.7rem' }}>{children}<style jsx>{`@media(max-width:720px){.xdrive-settings-form-grid{grid-template-columns:1fr!important}}`}</style></div>; }
export function SettingsFieldGroup({ label, hint, error, children, fullWidth }: { label: string; hint?: string; error?: string; children: ReactNode; fullWidth?: boolean }) { return <label style={{ display: 'grid', gap: '0.27rem', gridColumn: fullWidth ? '1/-1' : undefined, color: theme.text, fontSize: '0.69rem', fontWeight: 800 }}><span>{label}</span>{children}{hint && <small style={{ color: theme.muted, fontSize: '0.6rem', fontWeight: 500 }}>{hint}</small>}{error && <small style={{ color: theme.red, fontSize: '0.61rem' }}>{error}</small>}</label>; }
export const settingsInputStyle: CSSProperties = { width: '100%', border: `1px solid ${theme.borderStrong}`, borderRadius: 8, padding: '0.57rem 0.64rem', minHeight: 38, fontSize: '0.75rem', color: theme.text, background: '#fff', outlineColor: theme.blue };
export function SettingsNotice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'danger' | 'success'; children: ReactNode }) { const p = tone === 'danger' ? ['#fef2f2','#fecaca','#991b1b'] : tone === 'warning' ? ['#fffbeb','#fde68a','#92400e'] : tone === 'success' ? ['#f0fdf4','#bbf7d0','#166534'] : ['#eff6ff','#bfdbfe','#1e40af']; return <div style={{ background: p[0], border: `1px solid ${p[1]}`, color: p[2], borderRadius: 8, padding: '0.62rem 0.72rem', fontSize: '0.72rem', marginBottom: '0.68rem' }}>{children}</div>; }
export function SettingsSaveBar({ saving, disabled, onSave, label = 'Save changes', secondary }: { saving?: boolean; disabled?: boolean; onSave: () => void; label?: string; secondary?: ReactNode }) { return <div style={{ position: 'sticky', bottom: 0, zIndex: 15, display: 'flex', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'center', background: 'rgba(255,255,255,.96)', border: `1px solid ${theme.border}`, borderRadius: 9, padding: '0.58rem 0.68rem', marginTop: '0.7rem' }}><div>{secondary}</div><button type="button" disabled={disabled || saving} onClick={onSave} style={{ border: 0, borderRadius: 8, background: disabled || saving ? '#cbd5e1' : theme.blue, color: '#fff', padding: '0.55rem 0.82rem', fontSize: '0.72rem', fontWeight: 850, cursor: disabled || saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving…' : label}</button></div>; }
export function SettingsEmptyState({ title, description }: { title: string; description?: string }) { return <div style={{ minHeight: 150, display: 'grid', placeItems: 'center', textAlign: 'center', padding: '1.5rem' }}><div><strong style={{ color: theme.text, fontSize: '0.86rem' }}>{title}</strong>{description && <p style={{ color: theme.muted, fontSize: '0.7rem', maxWidth: 500 }}>{description}</p>}</div></div>; }
export function SettingsStatusBadge({ value }: { value: string }) { const good = /active|verified|connected|enabled|paid/i.test(value); return <span style={{ display: 'inline-flex', border: `1px solid ${good ? '#bbf7d0' : theme.border}`, background: good ? '#ecfdf3' : theme.soft, color: good ? theme.green : theme.muted, borderRadius: 999, padding: '0.17rem 0.42rem', fontSize: '0.61rem', fontWeight: 800 }}>{value.replace(/[_-]+/g,' ')}</span>; }
