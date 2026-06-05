'use client';

import ProtectedRoute from '../components/ProtectedRoute';
import SuperAdminWorkspaceShell from './_components/SuperAdminWorkspaceShell';

const THEME = {
  pageBg: '#0f172a',
  cardBg: '#1e293b',
  cardBorder: '#334155',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#f59e0b',
};

const KPI_CARDS = [
  { label: 'Total companies', value: '—', icon: '🏢' },
  { label: 'Active companies', value: '—', icon: '🟢' },
  { label: 'Total users', value: '—', icon: '👥' },
  { label: 'Open jobs', value: '—', icon: '📦' },
  { label: 'Open disputes', value: '—', icon: '⚖️' },
  { label: 'MRR', value: '—', icon: '💷' },
  { label: 'Failed payments', value: '—', icon: '💳' },
  { label: 'Compliance expiring soon', value: '—', icon: '⏰' },
] as const;

const GRID_PANELS = [
  { title: 'Platform Health', details: 'API uptime, queue lag, webhook failure indicators.', icon: '🩺' },
  { title: 'Approvals', details: 'Companies waiting for verification and approval.', icon: '✅' },
  { title: 'Risk', details: 'High-risk companies and users with escalation indicators.', icon: '🛡️' },
  { title: 'Support', details: 'Tickets, complaints and disputes against SLA targets.', icon: '🎫' },
  { title: 'Finance', details: 'Today revenue, unpaid invoices and churn risk.', icon: '📈' },
  { title: 'System Notifications', details: 'Latest critical platform events and notices.', icon: '🔔' },
] as const;

const QUICK_ACTIONS = [
  'Approve company',
  'Suspend company',
  'Escalate dispute',
  'Toggle feature flag',
  'Broadcast system notice',
] as const;

export default function SuperAdminDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <SuperAdminWorkspaceShell>
        <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: THEME.text, margin: 0 }}>XDrive Platform Administration</h1>
                <span style={{ fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: THEME.accent, backgroundColor: 'rgba(245,158,11,0.12)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                  Live/Staging
                </span>
              </div>
              <p style={{ color: THEME.muted, margin: 0, fontSize: '0.88rem' }}>Parent administration layer for the full XDrive marketplace.</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px', padding: '0.5rem 0.7rem', color: THEME.muted, fontSize: '0.78rem', minWidth: '180px' }}>
                Global search
              </div>
              <button style={{ backgroundColor: THEME.cardBg, color: THEME.text, border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px', padding: '0.5rem 0.65rem', cursor: 'pointer' }}>
                🔔
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {KPI_CARDS.map((card) => (
              <div key={card.label} style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '10px', padding: '0.85rem' }}>
                <div style={{ fontSize: '1.1rem', marginBottom: '0.35rem' }}>{card.icon}</div>
                <div style={{ color: THEME.text, fontSize: '1.15rem', fontWeight: 700 }}>{card.value}</div>
                <div style={{ color: THEME.muted, fontSize: '0.73rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{card.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 270px', gap: '0.9rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
              {GRID_PANELS.map((panel) => (
                <div key={panel.title} style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '10px', padding: '0.9rem' }}>
                  <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '1rem' }}>{panel.icon}</span>
                    <h2 style={{ margin: 0, color: THEME.text, fontSize: '0.9rem', fontWeight: 700 }}>{panel.title}</h2>
                  </div>
                  <p style={{ margin: 0, color: THEME.muted, fontSize: '0.78rem', lineHeight: 1.45 }}>{panel.details}</p>
                </div>
              ))}
            </div>

            <aside style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '10px', padding: '0.9rem', height: 'fit-content' }}>
              <h2 style={{ margin: '0 0 0.45rem', color: THEME.text, fontSize: '0.88rem', fontWeight: 700 }}>Quick Actions</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {QUICK_ACTIONS.map((label) => (
                  <button key={label} style={{ textAlign: 'left', padding: '0.5rem 0.6rem', borderRadius: '7px', border: `1px solid ${THEME.cardBorder}`, backgroundColor: '#0b1220', color: THEME.text, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                    {label}
                  </button>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </SuperAdminWorkspaceShell>
    </ProtectedRoute>
  );
}
