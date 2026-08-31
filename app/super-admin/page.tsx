'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  Route,
  Settings2,
  ShieldCheck,
  Store,
  Truck,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

import ProtectedRoute from '../components/ProtectedRoute';
import { SUPER_ADMIN_WORKSPACE_DEFINITION } from './_components/SuperAdminWorkspaceShell';
import { getAuthHeader } from './_lib/getAuthHeader';

type PlatformStats = {
  companiesTotal: number;
  companiesActive: number;
  companiesSuspended: number;
  companiesPending: number;
  driversTotal: number;
  jobsTotal: number;
  jobsOpen: number;
  jobsDelivered: number;
  invoicesTotal: number;
  invoicesUnpaid: number;
  compliancePending: number;
};

type ActionQueueItem = {
  id: string;
  severity: 'P0' | 'P1' | 'P2';
  title: string;
  description: string;
  entityName: string;
  href: string;
};

type CommandCentrePayload = {
  environment?: string;
  refreshedAt?: string;
  actionQueue?: {
    total: number;
    p0: number;
    p1: number;
    p2: number;
    items: ActionQueueItem[];
  };
};

type AreaMeta = {
  description: string;
  icon: LucideIcon;
  accent?: 'orange' | 'green' | 'purple' | 'navy';
  badge?: (stats: PlatformStats | null, command: CommandCentrePayload | null) => string | number | null;
};

const C = {
  navy: '#082a61',
  blue: '#1d57d8',
  orange: '#f59e0b',
  green: '#16a34a',
  purple: '#7c3aed',
  red: '#dc2626',
  text: '#172033',
  muted: '#66778e',
  border: '#dde5ef',
  bg: '#f4f7fb',
  white: '#fff',
};

const AREA_META: Record<string, AreaMeta> = {
  dashboard: {
    description: 'Overview of platform health, urgent actions, analytics and current Platform Owner priorities.',
    icon: LayoutDashboard,
    badge: (_stats, command) => command?.environment ?? 'LIVE',
  },
  companies: {
    description: 'Manage company onboarding, approval, active or suspended state, verification and compliance.',
    icon: Building2,
    accent: 'orange',
    badge: (stats) => stats?.companiesPending ?? null,
  },
  fleet: {
    description: 'Manage the driver register, driver availability and current fleet positions.',
    icon: UsersRound,
    badge: (stats) => stats?.driversTotal ?? null,
  },
  operations: {
    description: 'Oversee all jobs, active/pending/completed work, deliveries and POD queues.',
    icon: Route,
    badge: (stats) => stats?.jobsOpen ?? null,
  },
  marketplace: {
    description: 'Manage marketplace visibility, quotes, allocations and marketplace disputes.',
    icon: Store,
    accent: 'purple',
  },
  'xdrive-logistics': {
    description: 'Run XDrive Logistics own enquiries, jobs, marketplace work and broker workspace.',
    icon: Truck,
  },
  finance: {
    description: 'Review finance overview, invoices, payments, revenue and the financial breakdown.',
    icon: CreditCard,
    accent: 'green',
    badge: (stats) => stats?.invoicesUnpaid ?? null,
  },
  compliance: {
    description: 'Review documents, insurance, operator licences, expiry tracking and identity/fraud cases.',
    icon: ShieldCheck,
    badge: (stats) => stats?.compliancePending ?? null,
  },
  support: {
    description: 'Handle Action Centre items, persistent cases, support tickets, complaints and support disputes.',
    icon: LifeBuoy,
    accent: 'purple',
    badge: (_stats, command) => command?.actionQueue?.total ?? null,
  },
  'users-access': {
    description: 'Manage all users and inspect company owners, customers, dispatchers, drivers and platform admins.',
    icon: UsersRound,
  },
  platform: {
    description: 'Control global settings, roles, permissions, feature flags, notifications and audit history.',
    icon: Settings2,
    accent: 'navy',
  },
};

const AREA_ORDER = [
  'dashboard',
  'companies',
  'fleet',
  'operations',
  'marketplace',
  'xdrive-logistics',
  'finance',
  'compliance',
  'support',
  'users-access',
  'platform',
] as const;

function accentColor(accent?: AreaMeta['accent']) {
  if (accent === 'orange') return C.orange;
  if (accent === 'green') return C.green;
  if (accent === 'purple') return C.purple;
  if (accent === 'navy') return C.navy;
  return C.blue;
}

export default function Page() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [command, setCommand] = useState<CommandCentrePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const auth = await getAuthHeader();
    if (!auth) {
      setError('Session expired. Please sign in again.');
      setLoading(false);
      return;
    }

    try {
      const headers = { Authorization: auth };
      const [statsResult, commandResult] = await Promise.all([
        fetch('/api/super-admin/stats', { headers, cache: 'no-store' }),
        fetch('/api/super-admin/command-centre', { headers, cache: 'no-store' }),
      ]);
      const [statsBody, commandBody] = await Promise.all([
        statsResult.json().catch(() => null),
        commandResult.json().catch(() => null),
      ]);
      setStats(statsResult.ok && statsBody ? statsBody as PlatformStats : null);
      setCommand(commandResult.ok && commandBody ? commandBody as CommandCentrePayload : null);
      if (!statsResult.ok && !commandResult.ok) {
        setError('Live platform summary is temporarily unavailable. Navigation remains available.');
      }
    } catch {
      setError('Live platform summary is temporarily unavailable. Navigation remains available.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const areas = useMemo(() => AREA_ORDER.flatMap((id) => {
    const group = SUPER_ADMIN_WORKSPACE_DEFINITION.nav.find((entry) => entry.id === id);
    const meta = AREA_META[id];
    if (!group || !meta) return [];
    return [{ group, meta }];
  }), []);

  const summary = [
    {
      label: 'Active Jobs',
      value: stats?.jobsOpen,
      note: stats ? `${stats.jobsTotal} total jobs` : 'Live source unavailable',
      href: '/super-admin/operations/active-jobs',
      color: C.blue,
    },
    {
      label: 'Companies Requiring Action',
      value: stats?.companiesPending,
      note: stats ? `${stats.companiesTotal} companies registered` : 'Live source unavailable',
      href: '/super-admin/companies/approvals',
      color: C.orange,
    },
    {
      label: 'Missing / Pending Documents',
      value: stats?.compliancePending,
      note: 'Open document and compliance review',
      href: '/super-admin/compliance/documents',
      color: C.orange,
    },
    {
      label: 'Open Cases & Exceptions',
      value: command?.actionQueue?.total,
      note: 'Items requiring Platform Owner attention',
      href: '/super-admin/action-centre',
      color: C.green,
    },
  ];

  const topAttention = command?.actionQueue?.items?.slice(0, 3) ?? [];

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ background: C.bg, minHeight: '100%', padding: '22px 26px 30px' }}>
        <section style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#6f8096', fontSize: 10, fontWeight: 850, letterSpacing: '.09em', textTransform: 'uppercase' }}>Platform Owner</div>
            <h1 style={{ margin: '5px 0 0', color: C.navy, fontSize: 30, lineHeight: 1.05, fontWeight: 900 }}>Super Admin Control Centre</h1>
            <p style={{ margin: '8px 0 0', color: C.muted, fontSize: 13 }}>Find any area quickly, understand what it contains, and go directly to the right control.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} style={{ minHeight: 38, padding: '0 15px', border: `1px solid ${C.blue}`, borderRadius: 10, background: C.blue, color: C.white, fontWeight: 800, cursor: loading ? 'wait' : 'pointer' }}>
            {loading ? 'Refreshing…' : 'Refresh live status'}
          </button>
        </section>

        {error ? <div style={{ marginBottom: 16, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.orange}`, borderRadius: 10, background: C.white, padding: '10px 12px', color: C.muted, fontSize: 11 }}>{error}</div> : null}

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14, marginBottom: 24 }}>
          {summary.map((item) => (
            <Link key={item.label} href={item.href} style={{ minHeight: 118, display: 'grid', gridTemplateColumns: '52px minmax(0,1fr)', gap: 13, alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 16, background: C.white, padding: 16, textDecoration: 'none', boxShadow: '0 7px 22px rgba(8,42,97,.04)' }}>
              <span style={{ width: 52, height: 52, borderRadius: 16, display: 'grid', placeItems: 'center', background: `${item.color}12`, color: item.color }}><AlertTriangle size={24} /></span>
              <span style={{ minWidth: 0 }}>
                <strong style={{ display: 'block', color: C.text, fontSize: 11, fontWeight: 800 }}>{item.label}</strong>
                <span style={{ display: 'block', marginTop: 5, color: C.navy, fontSize: 28, lineHeight: 1, fontWeight: 900 }}>{item.value ?? '—'}</span>
                <span style={{ display: 'block', marginTop: 7, color: C.muted, fontSize: 9.5, lineHeight: 1.4 }}>{item.note}</span>
              </span>
            </Link>
          ))}
        </section>

        <section style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, color: C.navy, fontSize: 18, fontWeight: 900 }}>Choose what you want to manage</h2>
              <p style={{ margin: '5px 0 0', color: C.muted, fontSize: 11 }}>Every real Super Admin sub-function is shown inside its card; no sidebar option is intentionally omitted.</p>
            </div>
            <Link href="/super-admin/search" style={{ color: C.blue, fontSize: 11, fontWeight: 850, textDecoration: 'none' }}>Search the whole platform →</Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
            {areas.map(({ group, meta }) => {
              const Icon = meta.icon;
              const accent = accentColor(meta.accent);
              const badge = meta.badge?.(stats, command);
              const primaryHref = group.items[0]?.href ?? '/super-admin';
              return (
                <article key={group.id} style={{ minHeight: 285, display: 'flex', flexDirection: 'column', border: `1px solid ${C.border}`, borderRadius: 16, background: C.white, padding: 15, boxShadow: '0 7px 22px rgba(8,42,97,.035)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ width: 44, height: 44, borderRadius: 13, display: 'grid', placeItems: 'center', background: accent, color: C.white }}><Icon size={21} /></span>
                    {badge !== null && badge !== undefined ? <span style={{ borderRadius: 7, background: `${accent}12`, color: accent, padding: '5px 7px', fontSize: 9.5, fontWeight: 900 }}>{badge}</span> : null}
                  </div>

                  <Link href={primaryHref} style={{ marginTop: 14, color: C.navy, fontSize: 17, fontWeight: 900, textDecoration: 'none' }}>{group.label}</Link>
                  <p style={{ margin: '8px 0 0', color: C.muted, fontSize: 10.5, lineHeight: 1.55 }}>{meta.description}</p>

                  {group.id === 'companies' ? (
                    <div style={{ marginTop: 12, border: `1px solid #f2c46d`, borderRadius: 10, background: '#fffaf0', padding: 10 }}>
                      <strong style={{ display: 'block', color: '#9a6100', fontSize: 10 }}>Request completion</strong>
                      <span style={{ display: 'block', marginTop: 4, color: '#806b43', fontSize: 9.5, lineHeight: 1.45 }}>Identify missing onboarding or documents, confirm the request, send it, then retain the action in audit history.</span>
                    </div>
                  ) : null}

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'auto', paddingTop: 16 }}>
                    {group.items.map((item) => (
                      <Link key={item.id} href={item.href} title={item.label} style={{ border: `1px solid ${C.border}`, borderRadius: 999, background: '#fbfcfe', color: C.navy, padding: '6px 9px', fontSize: 9.2, fontWeight: 800, textDecoration: 'none' }}>{item.label}</Link>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section style={{ border: `1px solid ${C.border}`, borderRadius: 16, background: C.white, overflow: 'hidden' }}>
          <div style={{ minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 14px', borderBottom: `1px solid ${C.border}` }}>
            <div>
              <strong style={{ display: 'block', color: C.navy, fontSize: 12 }}>Needs attention now</strong>
              <span style={{ display: 'block', marginTop: 3, color: C.muted, fontSize: 9.5 }}>Only the highest-priority live items are shown here.</span>
            </div>
            <Link href="/super-admin/action-centre" style={{ color: C.blue, fontSize: 10, fontWeight: 850, textDecoration: 'none' }}>Open Action Centre →</Link>
          </div>
          {topAttention.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
              {topAttention.map((item) => (
                <Link key={item.id} href={item.href} style={{ minHeight: 90, padding: 14, borderRight: `1px solid ${C.border}`, textDecoration: 'none' }}>
                  <span style={{ display: 'block', color: item.severity === 'P0' ? C.red : C.orange, fontSize: 9, fontWeight: 900 }}>{item.severity}</span>
                  <strong style={{ display: 'block', marginTop: 7, color: C.text, fontSize: 11 }}>{item.title}</strong>
                  <span style={{ display: 'block', marginTop: 5, color: C.muted, fontSize: 9.5, lineHeight: 1.4 }}>{item.entityName}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ padding: 18, color: C.muted, fontSize: 10.5 }}>{loading ? 'Loading live priorities…' : 'No high-priority items are available from the current source set.'}</div>
          )}
        </section>
      </div>
    </ProtectedRoute>
  );
}
