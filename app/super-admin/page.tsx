'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../components/ProtectedRoute';
import { supabase } from '../../lib/supabaseClient';

const THEME = {
  pageBg: '#eef2f6',
  cardBg: '#ffffff',
  cardBorder: '#d7e0ea',
  text: '#0f172a',
  muted: '#475569',
  softMuted: '#64748b',
  blue: '#1d4ed8',
  green: '#15803d',
  amber: '#d97706',
  red: '#dc2626',
  ink: '#111827',
};

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
};

type ModuleCard = {
  title: string;
  eyebrow: string;
  href: string;
  accent: string;
  metric: string | number;
  metricLabel: string;
  detail: string;
  secondary: string;
};

const compactButton = (accent = THEME.blue) => ({
  border: 'none',
  borderRadius: '7px',
  backgroundColor: accent,
  color: '#ffffff',
  padding: '0.46rem 0.72rem',
  fontSize: '0.74rem',
  fontWeight: 800,
  cursor: 'pointer',
});

function KpiCard({ label, value, tone, loading }: { label: string; value: string | number; tone: string; loading: boolean }) {
  return (
    <section style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '9px', padding: '0.7rem 0.75rem', minHeight: '86px' }}>
      <div style={{ color: '#64748b', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 850, marginBottom: '0.28rem' }}>{label}</div>
      <div style={{ color: tone, fontSize: '1.38rem', fontWeight: 900, lineHeight: 1.05 }}>{loading ? '...' : value}</div>
    </section>
  );
}

function EmptyList({ children }: { children: string }) {
  return <div style={{ color: THEME.softMuted, fontSize: '0.8rem', padding: '0.45rem 0' }}>{children}</div>;
}

function DashboardContent() {
  const router = useRouter();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setError('No active session.'); setLoading(false); return; }

        const res = await fetch('/api/super-admin/stats', {
          headers: { Authorization: ['Bearer', session.access_token].join(' ') },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError((body as { error?: string }).error ?? `HTTP ${res.status}`);
          setLoading(false);
          return;
        }

        const data = await res.json() as PlatformStats;
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fetch failed.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const kpiCards = [
    { label: 'Total companies', value: stats?.companiesTotal ?? '-', tone: THEME.ink },
    { label: 'Active companies', value: stats?.companiesActive ?? '-', tone: THEME.green },
    { label: 'Pending approval', value: stats?.companiesPending ?? '-', tone: THEME.amber },
    { label: 'Open jobs', value: stats?.jobsOpen ?? '-', tone: THEME.blue },
    { label: 'Active drivers', value: stats?.driversTotal ?? '-', tone: '#4338ca' },
    { label: 'Delivered jobs', value: stats?.jobsDelivered ?? '-', tone: THEME.green },
    { label: 'Invoices', value: stats?.invoicesTotal ?? '-', tone: '#0f766e' },
    { label: 'Unpaid invoices', value: stats?.invoicesUnpaid ?? '-', tone: THEME.red },
  ];

  const modules = useMemo<ModuleCard[]>(() => [
    { title: 'Marketplace', eyebrow: 'Load governance', href: '/super-admin/marketplace', accent: '#0f766e', metric: stats?.jobsOpen ?? '-', metricLabel: 'Open jobs', detail: 'Global load-board visibility, carrier quotes and exception handling.', secondary: 'Open marketplace' },
    { title: 'Operations', eyebrow: 'Execution', href: '/super-admin/operations/jobs', accent: '#1d4ed8', metric: stats?.jobsTotal ?? '-', metricLabel: 'Total jobs', detail: 'All platform jobs, active deliveries, POD queue and allocation state.', secondary: 'Open jobs' },
    { title: 'Fleet', eyebrow: 'Capacity', href: '/super-admin/users/drivers', accent: '#4338ca', metric: stats?.driversTotal ?? '-', metricLabel: 'Drivers', detail: 'Driver network readiness, availability and live operating capacity.', secondary: 'Open drivers' },
    { title: 'Companies', eyebrow: 'Network', href: '/super-admin/companies', accent: '#111827', metric: stats?.companiesTotal ?? '-', metricLabel: 'Companies', detail: 'Customer, broker and operator estate with approval and suspension controls.', secondary: 'Open companies' },
    { title: 'Finance', eyebrow: 'Commercial', href: '/super-admin/finance/invoices', accent: '#0f766e', metric: stats?.invoicesUnpaid ?? '-', metricLabel: 'Unpaid', detail: 'Platform invoices, payment state and finance reporting.', secondary: 'Open finance' },
    { title: 'Compliance', eyebrow: 'Risk', href: '/super-admin/compliance/documents', accent: '#7c3aed', metric: stats?.companiesSuspended ?? '-', metricLabel: 'Suspended', detail: 'Documents, insurance, operator licences and expiry visibility.', secondary: 'Review documents' },
  ], [stats]);

  const healthRows = [
    { label: 'Email queue', value: 'Monitor', href: '/super-admin/notifications', tone: THEME.amber },
    { label: 'Webhook status', value: 'Review', href: '/super-admin/health', tone: THEME.blue },
    { label: 'Audit events', value: 'Open', href: '/super-admin/settings/audit-logs', tone: '#4338ca' },
    { label: 'Feature flags', value: 'Review', href: '/super-admin/settings/feature-flags', tone: THEME.ink },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1rem 1.15rem 1.4rem' }}>
      <section style={{ background: '#ffffff', border: `1px solid ${THEME.cardBorder}`, borderRadius: '10px', padding: '1rem 1.1rem', marginBottom: '0.9rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>Global Platform View</div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 850, color: THEME.text, margin: 0 }}>XDrive Owner Console</h1>
            <p style={{ color: THEME.muted, margin: '0.28rem 0 0', fontSize: '0.86rem', maxWidth: '760px', lineHeight: 1.45 }}>
              One operating view across marketplace, companies, jobs, finance, compliance and platform health.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/super-admin/companies/approvals')} style={compactButton(THEME.amber)}>Approvals</button>
            <button onClick={() => router.push('/super-admin/health')} style={{ ...compactButton(THEME.ink), backgroundColor: '#ffffff', color: THEME.ink, border: `1px solid ${THEME.cardBorder}` }}>Platform Health</button>
          </div>
        </div>
      </section>

      {error && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '9px', padding: '0.65rem 0.85rem', color: '#991b1b', fontSize: '0.82rem', marginBottom: '0.85rem' }}>
          Stats unavailable: {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))', gap: '0.62rem', marginBottom: '0.9rem' }}>
        {kpiCards.map((card) => <KpiCard key={card.label} label={card.label} value={card.value} tone={card.tone} loading={loading} />)}
      </div>

      <section style={{ marginBottom: '0.9rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.72rem' }}>
          {modules.map((module) => (
            <button key={module.title} onClick={() => router.push(module.href)} style={{ textAlign: 'left', backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderTop: `3px solid ${module.accent}`, borderRadius: '10px', padding: '0.9rem', cursor: 'pointer', minHeight: '184px' }}>
              <div style={{ color: '#64748b', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 850 }}>{module.eyebrow}</div>
              <h2 style={{ margin: '0.22rem 0 0.45rem', color: THEME.text, fontSize: '1rem', fontWeight: 850 }}>{module.title}</h2>
              <div style={{ color: module.accent, fontSize: '1.42rem', fontWeight: 900, lineHeight: 1 }}>{loading ? '...' : module.metric}</div>
              <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.1rem' }}>{module.metricLabel}</div>
              <p style={{ margin: '0.55rem 0 0.7rem', color: THEME.muted, fontSize: '0.78rem', lineHeight: 1.45 }}>{module.detail}</p>
              <span style={{ display: 'inline-block', color: module.accent, fontSize: '0.74rem', fontWeight: 850 }}>{module.secondary}</span>
            </button>
          ))}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.72rem' }}>
        <section style={{ background: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '10px', padding: '0.95rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.7rem', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1rem', color: THEME.text }}>Live activity</h2>
              <p style={{ margin: '0.22rem 0 0', fontSize: '0.78rem', color: THEME.muted }}>Recent jobs, registrations, invoices and dispute movement.</p>
            </div>
            <button onClick={() => router.push('/super-admin/settings/audit-logs')} style={{ background: 'none', border: 'none', color: THEME.blue, fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}>Audit log</button>
          </div>
          <EmptyList>No live activity feed is wired into this compact view yet.</EmptyList>
        </section>

        <section style={{ background: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '10px', padding: '0.95rem' }}>
          <div style={{ marginBottom: '0.75rem' }}>
            <h2 style={{ margin: 0, fontSize: '1rem', color: THEME.text }}>Platform health</h2>
            <p style={{ margin: '0.22rem 0 0', fontSize: '0.78rem', color: THEME.muted }}>Queue, webhook, email and audit checks in one compact block.</p>
          </div>
          <div style={{ display: 'grid', gap: '0.48rem' }}>
            {healthRows.map((row) => (
              <button key={row.label} onClick={() => router.push(row.href)} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem 0.65rem', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ color: THEME.text, fontSize: '0.8rem', fontWeight: 800 }}>{row.label}</span>
                <span style={{ color: row.tone, fontSize: '0.74rem', fontWeight: 850 }}>{row.value}</span>
              </button>
            ))}
          </div>
        </section>

        <section style={{ background: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '10px', padding: '0.95rem' }}>
          <div style={{ marginBottom: '0.75rem' }}>
            <h2 style={{ margin: 0, fontSize: '1rem', color: THEME.text }}>Governance actions</h2>
            <p style={{ margin: '0.22rem 0 0', fontSize: '0.78rem', color: THEME.muted }}>Fast access to the highest-risk owner controls.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: '0.45rem' }}>
            {[
              ['Approve company', '/super-admin/companies/approvals'],
              ['Hide load', '/super-admin/marketplace'],
              ['Review dispute', '/super-admin/operations/disputes'],
              ['Audit change', '/super-admin/settings/audit-logs'],
            ].map(([label, href]) => (
              <button key={label} onClick={() => router.push(href)} style={{ border: '1px solid #dbe4ef', background: '#ffffff', borderRadius: '8px', padding: '0.55rem', color: THEME.text, fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer' }}>{label}</button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function SuperAdminDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <DashboardContent />
    </ProtectedRoute>
  );
}
