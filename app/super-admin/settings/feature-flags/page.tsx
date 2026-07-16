'use client';

import ProtectedRoute from '@/app/components/ProtectedRoute';

const THEME = {
  pageBg: 'var(--background)',
  cardBg: 'var(--xd-surface)',
  cardBorder: 'var(--xd-border)',
  text: 'var(--xd-text)',
  muted: 'var(--xd-text-muted)',
  accent: 'var(--xd-gold)',
  green: 'var(--xd-green)',
};

const PLATFORM_FLAGS = [
  {
    key: 'exchange_marketplace',
    label: 'Exchange Marketplace',
    description: 'Allows companies to post jobs to the public exchange for bidding.',
    status: 'enabled',
    category: 'Marketplace',
  },
  {
    key: 'bid_acceptance_workflow',
    label: 'Bid Acceptance Workflow',
    description: 'Companies can accept/reject inbound bids on exchange jobs.',
    status: 'enabled',
    category: 'Operations',
  },
  {
    key: 'pod_capture',
    label: 'Proof of Delivery Capture',
    description: 'Drivers can capture POD photos and signature on delivery.',
    status: 'enabled',
    category: 'Operations',
  },
  {
    key: 'invoice_generation',
    label: 'Invoice Generation',
    description: 'Automatic invoice creation on job delivery confirmation.',
    status: 'enabled',
    category: 'Finance',
  },
  {
    key: 'dispute_filing',
    label: 'Invoice Dispute Filing',
    description: 'Companies can raise disputes against issued invoices.',
    status: 'enabled',
    category: 'Finance',
  },
  {
    key: 'stripe_billing_future_phase',
    label: 'Stripe Billing (Future Phase)',
    description: 'Stripe checkout/connect automation is explicitly out of MVP scope.',
    status: 'pending',
    category: 'Finance',
  },
  {
    key: 'notifications',
    label: 'Notification System',
    description: 'Real-time notifications for job events, bids, and compliance alerts.',
    status: 'enabled',
    category: 'Platform',
  },
  {
    key: 'driver_tracking',
    label: 'Live Driver Tracking',
    description: 'GPS location tracking for active driver deliveries.',
    status: 'enabled',
    category: 'Operations',
  },
  {
    key: 'public_quote_requests',
    label: 'Public Quote Requests',
    description: 'Anonymous visitors can request quotes via the marketing site.',
    status: 'enabled',
    category: 'Marketplace',
  },
  {
    key: 'compliance_gating',
    label: 'Compliance Gating',
    description: 'Blocks job posting for companies with outstanding compliance issues.',
    status: 'enabled',
    category: 'Compliance',
  },
] as const;

const statusColor = (s: string) =>
  s === 'enabled' ? THEME.green : s === 'disabled' ? '#F5A300' : THEME.accent;

const statusBg = (s: string) =>
  s === 'enabled' ? 'rgba(29, 87, 216, 0.1)' : s === 'disabled' ? 'rgba(245, 163, 0, 0.1)' : 'rgba(245, 163, 0, 0.1)';

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🚩</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: THEME.text, margin: 0 }}>Feature Flags</h1>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: THEME.accent, backgroundColor: 'rgba(245, 163, 0, 0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>Settings</span>
            </div>
            <p style={{ color: THEME.muted, margin: '0.25rem 0 0', fontSize: '0.85rem' }}>Platform feature rollout status. Dynamic toggle controls coming in next release.</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {(['Marketplace', 'Operations', 'Finance', 'Compliance', 'Platform'] as const).map((cat) => {
            const catFlags = PLATFORM_FLAGS.filter((f) => f.category === cat);
            const enabledCount = catFlags.filter((f) => f.status === 'enabled').length;
            return (
              <div key={cat} style={{ backgroundColor: '#1A1F2B', border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px', padding: '0.5rem 0.85rem' }}>
                <span style={{ color: THEME.text, fontSize: '0.82rem', fontWeight: 600 }}>{cat}</span>
                <span style={{ color: THEME.muted, fontSize: '0.72rem', marginLeft: '0.5rem' }}>{enabledCount}/{catFlags.length} enabled</span>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '0.75rem' }}>
          {PLATFORM_FLAGS.map((flag) => (
            <div
              key={flag.key}
              style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '10px', padding: '1rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: THEME.text, fontWeight: 700, fontSize: '0.88rem' }}>{flag.label}</div>
                  <div style={{ color: THEME.muted, fontSize: '0.68rem', fontFamily: 'monospace', marginTop: '0.1rem' }}>{flag.key}</div>
                </div>
                <span style={{
                  fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                  color: statusColor(flag.status),
                  backgroundColor: statusBg(flag.status),
                  padding: '0.2rem 0.6rem', borderRadius: '4px', whiteSpace: 'nowrap', marginLeft: '0.5rem',
                }}>
                  {flag.status}
                </span>
              </div>
              <p style={{ color: THEME.muted, fontSize: '0.78rem', margin: '0.25rem 0 0' }}>{flag.description}</p>
              <div style={{ marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.65rem', color: '#0B2F6B', backgroundColor: '#1A1F2B', padding: '0.15rem 0.4rem', borderRadius: '3px' }}>
                  {flag.category}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ProtectedRoute>
  );
}
