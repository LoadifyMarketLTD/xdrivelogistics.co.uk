'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../AuthContext';
import {
  hasWorkspaceCapability,
  resolveWorkspaceRole,
  type WorkspaceCapability,
  type WorkspaceRole,
} from '../../../lib/workspaceRole';
import { ActionButton, AlertBanner, EmptyState, StatusBadge, workspaceTheme } from './WorkspaceUI';

export type SettingsItem = {
  id: string;
  label: string;
  href: string;
  description?: string;
  capability?: WorkspaceCapability;
  roles?: WorkspaceRole[];
};

export type SettingsGroup = {
  id: string;
  label: string;
  items: SettingsItem[];
};

const roleRoot = (role: WorkspaceRole) => {
  if (role === 'customer') return '/customer';
  if (role === 'broker') return '/broker';
  if (role === 'driver' || role === 'owner_driver') return '/driver';
  if (role === 'platform_owner') return '/super-admin';
  return '/admin';
};

const buildSettingsGroups = (role: WorkspaceRole): SettingsGroup[] => {
  const root = roleRoot(role);
  const isDriver = role === 'driver' || role === 'owner_driver';
  const isCustomer = role === 'customer';
  const isBroker = role === 'broker';
  const isPlatform = role === 'platform_owner';

  const groups: SettingsGroup[] = [
    {
      id: 'account',
      label: 'Account',
      items: [
        {
          id: 'company',
          label: 'Company',
          description: 'Identity, contact and registered details',
          href: isCustomer ? '/customer/settings' : isBroker ? '/broker/settings' : isDriver ? '/driver/profile' : `${root}/settings`,
          capability: isDriver ? undefined : 'settings.manage',
          roles: isDriver ? ['owner_driver'] : undefined,
        },
        {
          id: 'profile',
          label: 'User profile',
          description: 'Personal identity and contact details',
          href: isDriver ? '/driver/profile' : `${root}/settings?section=userProfile`,
        },
        {
          id: 'members',
          label: 'Members / Team',
          description: 'Company membership and permissions',
          href: isCustomer ? '/customer/team' : isBroker ? '/broker/settings?section=members' : `${root}/dispatchers`,
          capability: 'company.members.manage',
        },
      ],
    },
    {
      id: 'operations',
      label: 'Operations',
      items: [
        {
          id: 'drivers',
          label: 'Drivers',
          description: 'Driver records and availability',
          href: isDriver ? '/driver/profile' : '/admin/drivers',
          capability: isDriver ? undefined : 'drivers.manage',
          roles: isDriver ? ['driver', 'owner_driver'] : undefined,
        },
        {
          id: 'vehicles',
          label: 'Vehicles',
          description: 'Vehicle identity and operating details',
          href: isDriver ? '/driver/vehicles' : '/admin/vehicles',
          capability: 'vehicles.manage',
        },
        {
          id: 'documents',
          label: 'Documents',
          description: 'Compliance records and secure file actions',
          href: isDriver ? '/driver/documents' : isCustomer ? '/customer/documents' : isBroker ? '/broker/pod-review' : '/admin/documents',
          capability: isDriver ? 'documents.own.manage' : isCustomer || isBroker ? 'jobs.review_pod' : 'documents.company.manage',
        },
      ],
    },
    {
      id: 'commercial',
      label: 'Commercial',
      items: [
        {
          id: 'billing',
          label: 'Billing',
          description: 'Invoices, payment settings and finance links',
          href: isCustomer ? '/customer/invoices' : isBroker ? '/broker/customer-invoices' : isDriver ? '/driver/finance' : '/admin/invoices',
          capability: isCustomer ? 'invoices.customer.manage' : isDriver ? 'invoices.carrier.manage' : isBroker ? 'invoices.customer.manage' : 'payments.manage',
        },
      ],
    },
    {
      id: 'preferences',
      label: 'Preferences',
      items: [
        {
          id: 'notifications',
          label: 'Notifications',
          description: 'Delivery channels and operational alerts',
          href: isCustomer ? '/customer/notifications' : isBroker ? '/broker/notifications' : isDriver ? '/driver/messages' : `${root}/settings?section=notifications`,
        },
        {
          id: 'security',
          label: 'Security',
          description: 'Password and account protection',
          href: isDriver ? '/driver/change-password' : `${root}/settings?section=security`,
        },
        {
          id: 'integrations',
          label: 'Integrations',
          description: 'Connected services supported by this workspace',
          href: `${root}/settings?section=integrations`,
          capability: isDriver ? undefined : 'settings.manage',
          roles: isDriver ? ['owner_driver'] : undefined,
        },
        {
          id: 'support',
          label: 'Support',
          description: 'Help, contact and service assistance',
          href: `${root}/settings?section=support`,
        },
      ],
    },
  ];

  if (isPlatform) {
    groups.unshift({
      id: 'platform',
      label: 'Platform',
      items: [
        { id: 'platform-settings', label: 'Platform settings', description: 'Global administration', href: '/super-admin/settings', capability: 'platform.manage' },
      ],
    });
  }

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.roles && !item.roles.includes(role)) return false;
        if (item.capability && !hasWorkspaceCapability(role, item.capability)) return false;
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);
};

const isRouteActive = (pathname: string, href: string) => {
  const [base] = href.split('?');
  return pathname === base || pathname.startsWith(`${base}/`);
};

export function SettingsPageHeader({
  eyebrow = 'Workspace settings',
  title,
  description,
  actions,
  status,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  status?: ReactNode;
}) {
  return (
    <header style={{ marginBottom: '0.8rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.8rem', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 520px' }}>
          <div style={{ color: workspaceTheme.blue, fontSize: '0.65rem', fontWeight: 850, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>{eyebrow}</div>
          <h1 style={{ margin: 0, color: workspaceTheme.text, fontSize: 'clamp(1.3rem, 2vw, 1.75rem)', lineHeight: 1.15, letterSpacing: '-0.025em' }}>{title}</h1>
          {description && <p style={{ margin: '0.32rem 0 0', color: workspaceTheme.muted, maxWidth: '850px', fontSize: '0.8rem', lineHeight: 1.48 }}>{description}</p>}
          {status && <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>{status}</div>}
        </div>
        {actions && <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>{actions}</div>}
      </div>
    </header>
  );
}

export function SettingsTopNav({ groups }: { groups: SettingsGroup[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const items = groups.flatMap((group) => group.items);
  return (
    <nav aria-label="Settings modules" style={{ display: 'flex', gap: '0.22rem', overflowX: 'auto', background: '#fff', border: `1px solid ${workspaceTheme.border}`, borderRadius: '9px', padding: '0.32rem', marginBottom: '0.75rem' }}>
      {items.map((item) => {
        const active = isRouteActive(pathname, item.href);
        return <button key={item.id} type="button" onClick={() => router.push(item.href)} style={{ whiteSpace: 'nowrap', border: 0, borderBottom: `2px solid ${active ? workspaceTheme.blue : 'transparent'}`, borderRadius: '6px', background: active ? '#eff6ff' : 'transparent', color: active ? workspaceTheme.blue : workspaceTheme.text, padding: '0.48rem 0.62rem', fontSize: '0.68rem', fontWeight: active ? 850 : 700, cursor: 'pointer' }}>{item.label}</button>;
      })}
    </nav>
  );
}

export function SettingsSidebar({ groups }: { groups: SettingsGroup[] }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <aside aria-label="Settings navigation" className="xdrive-enterprise-settings-sidebar" style={{ position: 'sticky', top: '70px', alignSelf: 'start', background: '#fff', border: `1px solid ${workspaceTheme.border}`, borderRadius: '9px', padding: '0.42rem', maxHeight: 'calc(100vh - 88px)', overflowY: 'auto' }}>
      {groups.map((group) => <div key={group.id} style={{ marginBottom: '0.42rem' }}><div style={{ padding: '0.25rem 0.42rem', color: workspaceTheme.muted, fontSize: '0.57rem', fontWeight: 850, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{group.label}</div>{group.items.map((item) => { const active = isRouteActive(pathname, item.href); return <button key={item.id} type="button" onClick={() => router.push(item.href)} style={{ width: '100%', border: 0, borderLeft: `3px solid ${active ? workspaceTheme.blue : 'transparent'}`, borderRadius: '7px', background: active ? '#eff6ff' : 'transparent', color: active ? workspaceTheme.blue : workspaceTheme.text, textAlign: 'left', padding: '0.52rem 0.58rem', marginBottom: '0.1rem', cursor: 'pointer' }}><strong style={{ display: 'block', fontSize: '0.7rem' }}>{item.label}</strong>{item.description && <small style={{ display: 'block', color: workspaceTheme.muted, fontSize: '0.6rem', lineHeight: 1.3, marginTop: '0.08rem' }}>{item.description}</small>}</button>; })}</div>)}
    </aside>
  );
}

export function SettingsLayout({ children, title, description, actions, status, groups: suppliedGroups }: { children: ReactNode; title: string; description?: string; actions?: ReactNode; status?: ReactNode; groups?: SettingsGroup[] }) {
  const { user } = useAuth();
  const role = resolveWorkspaceRole(user);
  const groups = useMemo(() => suppliedGroups ?? buildSettingsGroups(role), [role, suppliedGroups]);
  return (
    <div className="xdrive-enterprise-settings-page" style={{ width: '100%', maxWidth: 1500, margin: '0 auto', padding: '1rem clamp(0.7rem, 2vw, 1.35rem) 2rem', background: workspaceTheme.page }}>
      <SettingsPageHeader title={title} description={description} actions={actions} status={status} />
      <SettingsTopNav groups={groups} />
      <div className="xdrive-enterprise-settings-layout" style={{ display: 'grid', gridTemplateColumns: '235px minmax(0,1fr)', gap: '0.75rem', alignItems: 'start' }}>
        <SettingsSidebar groups={groups} />
        <main style={{ minWidth: 0 }}>{children}</main>
      </div>
      <style jsx global>{`
        @media (max-width: 920px) {
          .xdrive-enterprise-settings-layout { grid-template-columns: 1fr !important; }
          .xdrive-enterprise-settings-sidebar { position: static !important; display: flex; gap: 0.25rem; overflow-x: auto; max-height: none !important; }
          .xdrive-enterprise-settings-sidebar > div { min-width: 205px; margin-bottom: 0 !important; }
        }
        @media (max-width: 560px) {
          .xdrive-enterprise-settings-page { padding-left: 0.58rem !important; padding-right: 0.58rem !important; }
        }
      `}</style>
    </div>
  );
}

export function SettingsSection({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  return <section style={{ background: '#fff', border: `1px solid ${workspaceTheme.border}`, borderRadius: '9px', boxShadow: '0 2px 8px rgba(15,23,42,0.04)', overflow: 'hidden', marginBottom: '0.72rem' }}><div style={{ padding: '0.72rem 0.82rem', borderBottom: `1px solid ${workspaceTheme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.6rem', flexWrap: 'wrap' }}><div><h2 style={{ margin: 0, fontSize: '0.88rem', color: workspaceTheme.text }}>{title}</h2>{description && <p style={{ margin: '0.18rem 0 0', color: workspaceTheme.muted, fontSize: '0.68rem', lineHeight: 1.42 }}>{description}</p>}</div>{actions}</div><div style={{ padding: '0.82rem' }}>{children}</div></section>;
}

export function SettingsFormGrid({ children, columns = 2 }: { children: ReactNode; columns?: 1 | 2 | 3 }) {
  return <div className="xdrive-settings-form-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`, gap: '0.72rem' }}>{children}<style jsx>{`@media (max-width: 720px){.xdrive-settings-form-grid{grid-template-columns:1fr !important;}}`}</style></div>;
}

export function SettingsFieldGroup({ label, hint, error, children, fullWidth = false }: { label: string; hint?: string; error?: string; children: ReactNode; fullWidth?: boolean }) {
  return <label style={{ display: 'grid', gap: '0.28rem', gridColumn: fullWidth ? '1 / -1' : undefined, color: workspaceTheme.text, fontSize: '0.7rem', fontWeight: 800 }}><span>{label}</span>{children}{hint && <small style={{ color: workspaceTheme.muted, fontSize: '0.61rem', fontWeight: 500, lineHeight: 1.35 }}>{hint}</small>}{error && <small style={{ color: workspaceTheme.red, fontSize: '0.62rem', fontWeight: 700 }}>{error}</small>}</label>;
}

export const settingsInputStyle: CSSProperties = {
  width: '100%',
  border: `1px solid ${workspaceTheme.borderStrong}`,
  borderRadius: '8px',
  padding: '0.58rem 0.65rem',
  minHeight: '38px',
  fontSize: '0.76rem',
  color: workspaceTheme.text,
  background: '#fff',
  outlineColor: workspaceTheme.blue,
};

export function SettingsNotice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'danger' | 'success'; children: ReactNode }) {
  return <AlertBanner tone={tone}>{children}</AlertBanner>;
}

export function SettingsSaveBar({ saving, disabled, onSave, label = 'Save changes', secondary }: { saving?: boolean; disabled?: boolean; onSave: () => void; label?: string; secondary?: ReactNode }) {
  return <div style={{ position: 'sticky', bottom: 0, zIndex: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', background: 'rgba(255,255,255,0.96)', border: `1px solid ${workspaceTheme.border}`, borderRadius: '9px', padding: '0.6rem 0.7rem', marginTop: '0.72rem', boxShadow: '0 -2px 10px rgba(15,23,42,0.05)', backdropFilter: 'blur(8px)' }}><div>{secondary}</div><ActionButton tone="primary" disabled={disabled || saving} onClick={onSave}>{saving ? 'Saving…' : label}</ActionButton></div>;
}

export function SettingsEmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <EmptyState title={title} description={description} action={action} />;
}

export function SettingsStatusBadge({ value, tone }: { value: string; tone?: 'green' | 'blue' | 'orange' | 'red' | 'grey' | 'purple' }) {
  return <StatusBadge value={value} tone={tone} />;
}

export function SettingsModuleStatus({ label, status }: { label: string; status: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.7rem', alignItems: 'center', padding: '0.48rem 0', borderBottom: `1px solid ${workspaceTheme.border}`, fontSize: '0.7rem' }}><span style={{ color: workspaceTheme.muted }}>{label}</span><SettingsStatusBadge value={status} /></div>;
}

export function SettingsPlaceholder({ title, description }: { title: string; description: string }) {
  return <SettingsSection title={title}><SettingsEmptyState title={title} description={description} /></SettingsSection>;
}
