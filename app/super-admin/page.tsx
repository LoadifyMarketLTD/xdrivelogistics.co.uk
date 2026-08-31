'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
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

type QuickLink = { label: string; href: string };
type Area = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  links: QuickLink[];
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

const AREAS: Area[] = [
  {
    title: 'Command Centre',
    description: 'Overview of platform health, urgent actions and the latest activity across XDrive.',
    href: '/super-admin',
    icon: LayoutDashboard,
    links: [
      { label: 'Overview', href: '/super-admin' },
      { label: 'Urgent actions', href: '/super-admin/action-centre' },
      { label: 'Platform health', href: '/super-admin/health' },
      { label: 'Analytics', href: '/super-admin/analytics' },
    ],
    badge: (_stats, command) => command?.environment ?? 'LIVE',
  },
  {
    title: 'Companies',
    description: 'Manage all companies, approvals, onboarding, verification, compliance and suspended accounts.',
    href: '/super-admin/companies',
    icon: Building2,
    accent: 'orange',
    links: [
      { label: 'All companies', href: '/super-admin/companies' },
      { label: 'Pending approval', href: '/super-admin/companies/approvals' },
      { label: 'Onboarding', href: '/super-admin/companies/verification' },
      { label: 'Compliance', href: '/super-admin/companies/compliance' },
    ],
    badge: (stats) => stats?.companiesPending ?? null,
  },
  {
    title: 'Drivers & Fleet',
    description: 'Manage drivers, owner drivers, vehicles, availability and fleet positions.',
    href: '/super-admin/users/drivers',
    icon: UsersRound,
    links: [
      { label: 'Drivers', href: '/super-admin/users/drivers' },
      { label: 'Availability', href: '/super-admin/operations/driver-availability' },
      { label: 'Fleet positions', href: '/super-admin/operations/fleet-positions' },
    ],
    badge: (stats) => stats?.driversTotal ?? null,
  },
  {
    title: 'Operations',
    description: 'Oversee jobs, deliveries, PODs, disputes and operational performance.',
    href: '/super-admin/operations/jobs',
    icon: Route,
    links: [
      { label: 'Jobs', href: '/super-admin/operations/jobs' },
      { label: 'Active jobs', href: '/super-admin/operations/active-jobs' },
      { label: 'Deliveries', href: '/super-admin/operations/deliveries' },
      { label: 'POD', href: '/super-admin/operations/pods' },
    ],
    badge: (stats) => stats?.jobsOpen ?? null,
  },
  {
    title: 'Marketplace',
    description: 'Manage marketplace visibility, quotes, allocations, disputes and exchange activity.',
    href: '/super-admin/marketplace',
    icon: Store,
    accent: 'purple',
    links: [
      { label: 'Marketplace', href: '/super-admin/marketplace' },
      { label: 'Quotes', href: '/super-admin/operations/quotes' },
      { label: 'Allocations', href: '/super-admin/operations/allocations' },
      { label: 'Disputes', href: '/super-admin/operations/disputes' },
    ],
  },
  {
    title: 'XDrive Logistics',
    description: 'Run XDrive Logistics own enquiries, jobs, marketplace work and broker operations.',
    href: '/super-admin/xdrive-logistics',
    icon: Truck,
    links: [
      { label: 'Overview', href: '/super-admin/xdrive-logistics' },
      { label: 'Jobs', href: '/super-admin/xdrive-logistics/jobs' },
      { label: 'Marketplace', href: '/super-admin/xdrive-logistics/marketplace' },
      { label: 'Broker workspace', href: '/broker' },
    ],
  },
  {
    title: 'Finance',
    description: 'Track invoices, payments, reconciliation, revenue and financial breakdowns.',
    href: '/super-admin/finance',
    icon: CreditCard,
    accent: 'green',
    links: [
      { label: 'Invoices', href: '/super-admin/finance/invoices' },
      { label: 'Payments', href: '/super-admin/finance/payments' },
      { label: 'Revenue', href: '/super-admin/finance/revenue' },
      { label: 'Breakdown', href: '/super-admin/finance/fees' },
    ],
    badge: (stats) => stats?.invoicesUnpaid ?? null,
  },
  {
    title: 'Compliance',
    description: 'Review documents, insurance, licences, expiries and identity or fraud issues.',
    href: '/super-admin/compliance/documents',
    icon: ShieldCheck,
    links: [
      { label: 'Documents', href: '/super-admin/compliance/documents' },
      { label: 'Insurance', href: '/super-admin/compliance/insurance' },
      { label: 'Licences', href: '/super-admin/compliance/operator-licences' },
      { label: 'Fraud review', href: '/super-admin/compliance/fraud-cases' },
    ],
    badge: (stats) => stats?.compliancePending ?? null,
  },
  {
    title: 'Support & Cases',
    description: 'Manage Action Centre items, platform cases, support tickets, complaints and disputes.',
    href: '/super-admin/action-centre',
    icon: LifeBuoy,
    accent: 'purple',
    links: [
      { label: 'Action Centre', href: '/super-admin/action-centre' },
      { label: 'Case Centre', href: '/super-admin/cases' },
      { label: 'Tickets', href: '/super-admin/support/tickets' },
      { label: 'Complaints', href: '/super-admin/support/complaints' },
    ],
    badge: (_stats, command) => command?.actionQueue?.total ?? null,
  },
  {
    title: 'Users & Access',
    description: 'Manage platform users and understand owners, customers, dispatchers, drivers and admin access.',
    href: '/super-admin/users',
    icon: UsersRound,
    links: [
      { label: 'All users', href: '/super-admin/users' },
      { label: 'Company owners', href: '/super-admin/users/company-owners' },
      { label: 'Dispatchers', href: '/super-admin/users/dispatchers' },
      { label: 'Platform admins', href: '/super-admin/users/platform-admins' },
    ],
  },
  {
    title: 'Platform & Security',
    description: 'Control settings, roles, permissions, feature flags, notifications and audit history.',
    href: '/super-admin/settings/global',
    icon: Settings2,
    accent: 'navy',
    links: [
      { label: 'Global settings', href: '/super-admin/settings/global' },
      { label: 'Roles & permissions', href: '/super-admin/settings/roles-permissions' },
      { label: 'Feature flags', href: '/super-admin/settings/feature-flags' },
      { label: 'Audit logs', href: '/super-admin/settings/audit-logs' },
    ],
  },
];

function accentColor(area: Area) {
  if (area.accent === 'orange') return C.orange;
  if (area.accent === 'green') return C.green;
  if (area.accent === 'purple') return C.purple;
  if (area.accent === 'navy') return C.navy;
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
      if (!statsResult.ok && !commandResult.ok) setError('Live platform summary is temporarily unavailable. Navigation remains available.');
    } catch {
      setError('Live platform summary is temporarily unavailable. Navigation remains available.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

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
            <p style={{ margin: '8px 0 0', color: C.muted, fontSize: 13 }}>Find any area quickly, monitor platform activity, and investigate issues across XDrive.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} style={{ minHeight: 38, padding: '0 15px', border: `1px solid ${C.blue}`, borderRadius: 10, background: C.blue, color: C.white, fontWeight: 800, cursor: loading ? 'wait' : 'pointer' }}>{loading ? 'Refreshing…' : 'Refresh live status'}</button>
        </section>

        {error ? <div style={{ marginBottom: 16, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.orange}`, borderRadius: 10, background: C.white, padding: '10px 12px', color: C.muted, fontSize: 11 }}>{error}</div> : null}

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 14, marginBottom: 22 }} className="sa-home-summary-grid">
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

        <section style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 11 }}>
            <div>
              <h2 style={{ margin: 0, color: C.navy, fontSize: 17, fontWeight: 900 }}>Choose what you want to manage</h2>
              <p style={{ margin: '4px 0 0', color: C.muted, fontSize: 11 }}>Each card explains what is inside, so you do not need to remember technical menu names.</p>
            </div>
            <Link href="/super-admin/search" style={{ color: C.blue, fontSize: 11, fontWeight: 800, textDecoration: 'none' }}>Search the whole platform →</Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 14 }} className="sa-home-area-grid">
            {AREAS.map((area) => {
              const Icon = area.icon;
              const color = accentColor(area);
              const badge = area.badge?.(stats, command);
              return (
                <article key={area.title} style={{ minHeight: 250, display: 'flex', flexDirection: 'column', border: `1px solid ${C.border}`, borderRadius: 16, background: C.white, padding: 15, boxShadow: '0 7px 24px rgba(8,42,97,.035)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ width: 46, height: 46, borderRadius: 14, display: 'grid', placeItems: 'center', background: color, color: '#fff', boxShadow: `0 8px 18px ${color}22` }}><Icon size={22} /></span>
                    {badge !== null && badge !== undefined ? <span style={{ padding: '5px 8px', borderRadius: 8, background: `${color}12`, color, fontSize: 10, fontWeight: 900 }}>{badge}</span> : null}
                  </div>

                  <Link href={area.href} style={{ marginTop: 14, color: C.navy, fontSize: 17, fontWeight: 900, textDecoration: 'none' }}>{area.title}</Link>
                  <p style={{ margin: '7px 0 0', color: C.muted, fontSize: 10.5, lineHeight: 1.55 }}>{area.description}</p>

                  {area.title === 'Companies' ? (
                    <Link href="/super-admin/companies/compliance" style={{ marginTop: 12, border: '1px solid #f3cf8a', borderRadius: 10, background: '#fff9ee', padding: '9px 10px', color: '#9b6100', textDecoration: 'none' }}>
                      <strong style={{ display: 'block', fontSize: 10.5 }}>Request completion</strong>
                      <span style={{ display: 'block', marginTop: 3, fontSize: 9, lineHeight: 1.4 }}>Find missing documents or unfinished onboarding and send a completion request.</span>
                    </Link>
                  ) : null}

                  <div style={{ marginTop: 'auto', paddingTop: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {area.links.map((link) => (
                      <Link key={link.label} href={link.href} style={{ border: `1px solid ${C.border}`, borderRadius: 999, background: '#fbfcfe', padding: '5px 8px', color: '#53667e', fontSize: 8.8, fontWeight: 750, textDecoration: 'none' }}>{link.label}</Link>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {topAttention.length ? (
          <section style={{ marginTop: 20, border: `1px solid ${C.border}`, borderRadius: 16, background: C.white, overflow: 'hidden' }}>
            <div style={{ minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 14px', borderBottom: `1px solid ${C.border}`, background: '#fbfcfe' }}>
              <div><strong style={{ display: 'block', color: C.navy, fontSize: 12 }}>Needs attention now</strong><span style={{ color: C.muted, fontSize: 9.5 }}>Only the highest-priority live items are shown here.</span></div>
              <Link href="/super-admin/action-centre" style={{ color: C.blue, fontSize: 10, fontWeight: 800, textDecoration: 'none' }}>Open Action Centre →</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 0 }} className="sa-home-attention-grid">
              {topAttention.map((item, index) => (
                <Link key={item.id} href={item.href || '/super-admin/action-centre'} style={{ minHeight: 92, padding: 14, borderRight: index < topAttention.length - 1 ? `1px solid ${C.border}` : 'none', textDecoration: 'none' }}>
                  <span style={{ color: item.severity === 'P0' ? C.red : C.orange, fontSize: 9, fontWeight: 900 }}>{item.severity}</span>
                  <strong style={{ display: 'block', marginTop: 5, color: C.text, fontSize: 11 }}>{item.title}</strong>
                  <span style={{ display: 'block', marginTop: 4, color: C.muted, fontSize: 9.5, lineHeight: 1.4 }}>{item.entityName || item.description}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <style jsx global>{`
          @media (max-width: 1380px) {
            .sa-home-area-grid { grid-template-columns: repeat(4,minmax(0,1fr)) !important; }
          }
          @media (max-width: 1120px) {
            .sa-home-summary-grid { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
            .sa-home-area-grid { grid-template-columns: repeat(3,minmax(0,1fr)) !important; }
          }
          @media (max-width: 820px) {
            .sa-home-area-grid { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
            .sa-home-attention-grid { grid-template-columns: 1fr !important; }
          }
          @media (max-width: 620px) {
            .sa-home-summary-grid, .sa-home-area-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </ProtectedRoute>
  );
}
