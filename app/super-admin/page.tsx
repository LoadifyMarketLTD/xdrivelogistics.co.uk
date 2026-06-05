'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../components/ProtectedRoute';
import SuperAdminWorkspaceShell from './_components/SuperAdminWorkspaceShell';
import { supabase } from '../../lib/supabaseClient';

const THEME = {
  pageBg: '#0f172a',
  cardBg: '#1e293b',
  cardBorder: '#334155',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#f59e0b',
  green: '#22c55e',
  red: '#ef4444',
};

type PlatformStats = {
  companiesTotal: number;
  companiesActive: number;
  companiesPending: number;
  driversTotal: number;
  jobsTotal: number;
  jobsOpen: number;
  invoicesTotal: number;
};

const GRID_PANELS = [
  { title: 'Platform Health', details: 'API uptime, queue lag, webhook failure indicators.', icon: '🩺', href: '/super-admin/health' },
  { title: 'Approvals', details: 'Companies waiting for verification and approval.', icon: '✅', href: '/super-admin/companies/approvals' },
  { title: 'Suspended', details: 'Suspended companies and reinstatement management.', icon: '🚫', href: '/super-admin/companies/suspended' },
  { title: 'Support', details: 'Tickets, complaints and disputes against SLA targets.', icon: '🎫', href: '/super-admin/support/tickets' },
  { title: 'Finance', details: 'Revenue overview, unpaid invoices and subscriptions.', icon: '📈', href: '/super-admin/finance/revenue' },
  { title: 'System Notifications', details: 'Latest critical platform events and notices.', icon: '🔔', href: '/super-admin/notifications' },
] as const;

const QUICK_ACTION_LINKS = [
  { label: 'Approve company', href: '/super-admin/companies/approvals' },
  { label: 'Suspended companies', href: '/super-admin/companies/suspended' },
  { label: 'All companies', href: '/super-admin/companies' },
  { label: 'All drivers', href: '/super-admin/users/drivers' },
  { label: 'Feature flags', href: '/super-admin/settings/feature-flags' },
] as const;

function KpiCard({ label, value, icon, loading }: { label: string; value: string | number; icon: string; loading: boolean }) {
  return (
    <div style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '10px', padding: '0.85rem' }}>
      <div style={{ fontSize: '1.1rem', marginBottom: '0.35rem' }}>{icon}</div>
      <div style={{ color: THEME.text, fontSize: '1.15rem', fontWeight: 700, minHeight: '1.5rem' }}>
        {loading ? <span style={{ color: THEME.muted }}>…</span> : value}
      </div>
      <div style={{ color: THEME.muted, fontSize: '0.73rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{label}</div>
    </div>
  );
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
    { label: 'Total companies', value: stats?.companiesTotal ?? '—', icon: '🏢' },
    { label: 'Active companies', value: stats?.companiesActive ?? '—', icon: '🟢' },
    { label: 'Pending approval', value: stats?.companiesPending ?? '—', icon: '⏳' },
    { label: 'Total drivers', value: stats?.driversTotal ?? '—', icon: '🚚' },
    { label: 'Total jobs', value: stats?.jobsTotal ?? '—', icon: '📦' },
    { label: 'Open jobs', value: stats?.jobsOpen ?? '—', icon: '📬' },
    { label: 'Total invoices', value: stats?.invoicesTotal ?? '—', icon: '🧾' },
    { label: 'MRR', value: '—', icon: '💷' },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: THEME.text, margin: 0 }}>XDrive Platform Administration</h1>
            <span style={{ fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: THEME.accent, backgroundColor: 'rgba(245,158,11,0.12)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
              Owner Console
            </span>
          </div>
          <p style={{ color: THEME.muted, margin: 0, fontSize: '0.88rem' }}>Parent administration layer for the full XDrive marketplace.</p>
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: `1px solid ${THEME.red}`, borderRadius: '8px', padding: '0.65rem 0.9rem', color: THEME.red, fontSize: '0.82rem', marginBottom: '1rem' }}>
          ⚠️ Stats unavailable: {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {kpiCards.map((card) => (
          <KpiCard key={card.label} label={card.label} value={card.value} icon={card.icon} loading={loading} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 270px', gap: '0.9rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
          {GRID_PANELS.map((panel) => (
            <button
              key={panel.title}
              onClick={() => router.push(panel.href)}
              style={{ textAlign: 'left', backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '10px', padding: '0.9rem', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'center', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '1rem' }}>{panel.icon}</span>
                <h2 style={{ margin: 0, color: THEME.text, fontSize: '0.9rem', fontWeight: 700 }}>{panel.title}</h2>
              </div>
              <p style={{ margin: 0, color: THEME.muted, fontSize: '0.78rem', lineHeight: 1.45 }}>{panel.details}</p>
            </button>
          ))}
        </div>

        <aside style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '10px', padding: '0.9rem', height: 'fit-content' }}>
          <h2 style={{ margin: '0 0 0.45rem', color: THEME.text, fontSize: '0.88rem', fontWeight: 700 }}>Quick Actions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {QUICK_ACTION_LINKS.map(({ label, href }) => (
              <button
                key={label}
                onClick={() => router.push(href)}
                style={{ textAlign: 'left', padding: '0.5rem 0.6rem', borderRadius: '7px', border: `1px solid ${THEME.cardBorder}`, backgroundColor: '#0b1220', color: THEME.text, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
              >
                {label}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function SuperAdminDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <SuperAdminWorkspaceShell>
        <DashboardContent />
      </SuperAdminWorkspaceShell>
    </ProtectedRoute>
  );
}
