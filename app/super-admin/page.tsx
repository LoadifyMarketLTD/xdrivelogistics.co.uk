'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
  badge?: (stats: PlatformStats | null, command: CommandCentrePayload | null) => string | number | null;
};

const AREA_META: Record<string, AreaMeta> = {
  dashboard: {
    description: 'Overview, urgent actions, analytics and live platform health.',
    icon: LayoutDashboard,
    badge: (_stats, command) => command?.environment ?? 'LIVE',
  },
  'xdrive-logistics': {
    description: 'Run XDrive Logistics enquiries, jobs and operational workspace.',
    icon: Truck,
  },
  marketplace: {
    description: 'Manage marketplace visibility, quotes, allocations and disputes.',
    icon: Store,
  },
  operations: {
    description: 'Monitor jobs, deliveries, POD queues and operational exceptions.',
    icon: Route,
    badge: (stats) => stats?.jobsOpen ?? null,
  },
  fleet: {
    description: 'Manage drivers, availability and fleet positions.',
    icon: UsersRound,
    badge: (stats) => stats?.driversTotal ?? null,
  },
  companies: {
    description: 'Manage company onboarding, approvals, verification and compliance.',
    icon: Building2,
    badge: (stats) => stats?.companiesPending ?? null,
  },
  'users-access': {
    description: 'Manage platform users and workspace access authority.',
    icon: UsersRound,
  },
  finance: {
    description: 'Review invoices, payments, reconciliation and revenue.',
    icon: CreditCard,
    badge: (stats) => stats?.invoicesUnpaid ?? null,
  },
  compliance: {
    description: 'Review documents, insurance, licences, expiries and fraud.',
    icon: ShieldCheck,
    badge: (stats) => stats?.compliancePending ?? null,
  },
  support: {
    description: 'Handle Action Centre items, cases, tickets, complaints and disputes.',
    icon: LifeBuoy,
    badge: (_stats, command) => command?.actionQueue?.total ?? null,
  },
  platform: {
    description: 'Control settings, permissions, notifications and audit logs.',
    icon: Settings2,
  },
};

const AREA_ORDER = [
  'dashboard',
  'xdrive-logistics',
  'marketplace',
  'operations',
  'fleet',
  'companies',
  'users-access',
  'finance',
  'compliance',
  'support',
  'platform',
] as const;

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
      label: 'Active jobs',
      value: stats?.jobsOpen,
      note: stats ? `${stats.jobsTotal} total jobs` : 'Live source unavailable',
      href: '/super-admin/operations/active-jobs',
      tone: 'blue',
    },
    {
      label: 'Companies requiring action',
      value: stats?.companiesPending,
      note: stats ? `${stats.companiesTotal} companies registered` : 'Live source unavailable',
      href: '/super-admin/companies/approvals',
      tone: 'orange',
    },
    {
      label: 'Pending document review',
      value: stats?.compliancePending,
      note: 'Open compliance review queue',
      href: '/super-admin/compliance/documents',
      tone: 'orange',
    },
    {
      label: 'Open cases & exceptions',
      value: command?.actionQueue?.total,
      note: 'Items requiring Platform Owner attention',
      href: '/super-admin/action-centre',
      tone: 'green',
    },
  ] as const;

  const topAttention = command?.actionQueue?.items?.slice(0, 5) ?? [];

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div className="sa-page sa-home-page">
        <header className="sa-page-header">
          <div className="sa-page-heading">
            <div className="sa-eyebrow">Platform owner · command centre</div>
            <h1 className="sa-page-title">Super Admin Control Centre</h1>
            <p className="sa-page-description">One control plane for platform health, operational priorities and every Super Admin workspace.</p>
          </div>
          <div className="sa-page-actions">
            <Link href="/super-admin/search" className="sa-secondary-button">Search platform</Link>
            <button type="button" className="sa-primary-button" onClick={() => void load()} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh live status'}
            </button>
          </div>
        </header>

        {error ? <div className="sa-state-block" data-tone="warning">{error}</div> : null}

        <section className="sa-metric-grid sa-home-metric-grid" aria-label="Platform summary">
          {summary.map((item) => (
            <Link key={item.label} href={item.href} className="sa-home-metric-link">
              <div className="sa-metric-card" data-tone={item.tone}>
                <div className="sa-metric-value">{item.value ?? '—'}</div>
                <div className="sa-metric-label">{item.label}</div>
                <div className="sa-home-metric-note">{item.note}</div>
              </div>
            </Link>
          ))}
        </section>

        <section className="sa-directory-section">
          <div className="sa-section-heading-row">
            <div>
              <div className="sa-eyebrow">Super Admin directory</div>
              <h2 className="sa-section-title">Choose an area by what you want to manage</h2>
              <p className="sa-section-description">The same premium navigation language used across the whole Super Admin. Every canonical sub-function remains available.</p>
            </div>
            <Link href="/super-admin/search" className="sa-section-link">Search the whole platform →</Link>
          </div>

          <div className="sa-directory-grid">
            {areas.map(({ group, meta }) => {
              const Icon = meta.icon;
              const badge = meta.badge?.(stats, command);
              const primaryHref = group.items[0]?.href ?? '/super-admin';
              return (
                <article key={group.id} className="sa-directory-card">
                  <div className="sa-directory-card-head">
                    <span className="sa-directory-icon"><Icon size={18} /></span>
                    <div className="sa-directory-card-copy">
                      <div className="sa-directory-title-row">
                        <Link href={primaryHref} className="sa-directory-title">{group.label}</Link>
                        {badge !== null && badge !== undefined ? <span className="sa-directory-badge">{badge}</span> : null}
                      </div>
                      <p>{meta.description}</p>
                    </div>
                  </div>

                  <div className="sa-directory-links">
                    {group.items.map((item) => (
                      <Link key={item.id} href={item.href}>{item.label}<span aria-hidden="true">→</span></Link>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="sa-panel sa-attention-panel">
          <div className="sa-panel-header sa-attention-header">
            <div>
              <div className="sa-eyebrow">Operational priority</div>
              <h2 className="sa-panel-title">Needs attention now</h2>
              <p className="sa-section-description">Only the highest-priority live Platform Owner items are shown here.</p>
            </div>
            <Link href="/super-admin/action-centre" className="sa-section-link">Open Action Centre →</Link>
          </div>

          {topAttention.length ? (
            <div className="sa-attention-list">
              {topAttention.map((item) => (
                <Link key={item.id} href={item.href} className="sa-attention-row">
                  <span className={`sa-priority-pill sa-priority-${item.severity.toLowerCase()}`}>{item.severity}</span>
                  <span className="sa-attention-copy">
                    <strong>{item.title}</strong>
                    <small>{item.entityName}{item.description ? ` · ${item.description}` : ''}</small>
                  </span>
                  <span className="sa-attention-open">Inspect →</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="sa-empty">No live priority items are available from the current source.</div>
          )}
        </section>
      </div>
    </ProtectedRoute>
  );
}
