'use client';

import ProtectedRoute from '@/app/components/ProtectedRoute';

const THEME = {
  pageBg: '#0f172a',
  cardBg: '#1e293b',
  cardBorder: '#334155',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#f59e0b',
};

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🎫</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: THEME.text, margin: 0 }}>Support Tickets</h1>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: THEME.accent, backgroundColor: 'rgba(245,158,11,0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>Support</span>
            </div>
            <p style={{ color: THEME.muted, margin: '0.25rem 0 0', fontSize: '0.85rem' }}>Support ticket queue and SLA management.</p>
          </div>
        </div>

        <div style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '12px', padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎫</div>
          <h2 style={{ color: THEME.text, fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
            Ticketing System Not Yet Configured
          </h2>
          <p style={{ color: THEME.muted, fontSize: '0.85rem', maxWidth: '480px', margin: '0 auto 1.25rem' }}>
            The XDrive support ticket integration is not yet active. Tickets will appear here once a ticketing provider
            is connected. In the meantime, use the Disputes module for invoice-related issues and the Complaints
            module for partner feedback.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="/super-admin/support/disputes"
              style={{ padding: '0.5rem 1.25rem', backgroundColor: THEME.accent, color: '#0f172a', borderRadius: '8px', fontWeight: 700, fontSize: '0.82rem', textDecoration: 'none' }}
            >
              ⚖️ View Disputes
            </a>
            <a
              href="/super-admin/support/complaints"
              style={{ padding: '0.5rem 1.25rem', backgroundColor: '#1e293b', color: THEME.text, border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px', fontWeight: 600, fontSize: '0.82rem', textDecoration: 'none' }}
            >
              ⚠️ View Complaints
            </a>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
