'use client';

import { useRouter } from 'next/navigation';
import ProtectedRoute from '../components/ProtectedRoute';

export default function BrokerDashboardPage() {
  const router = useRouter();

  return (
    <ProtectedRoute allowedRoles={['broker', 'owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', padding: '1.5rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🤝</span>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Broker Workspace</h1>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.12)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
              Broker
            </span>
          </div>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9rem' }}>
            Load publishing, bid management and carrier award decisions.
          </p>
        </div>

        {/* Module cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {[
            { icon: '📋', label: 'Load Board',       desc: 'Browse and manage published loads on the exchange.',    href: '/admin/marketplace' },
            { icon: '💼', label: 'Bid Book',          desc: 'Review all incoming bids and carrier proposals.',        href: '/admin/bids' },
            { icon: '🏆', label: 'Award Decisions',   desc: 'Accept bids and confirm carrier assignments.',           href: '/admin/bids' },
            { icon: '💬', label: 'Quotes',            desc: 'Manage quote requests from customers.',                  href: '/admin/quotes' },
            { icon: '📦', label: 'Jobs',              desc: 'Track job progress and delivery milestones.',            href: '/admin/jobs' },
            { icon: '💰', label: 'Invoices',          desc: 'Finance visibility: invoice and payment records.',       href: '/admin/invoices' },
          ].map(({ icon, label, desc, href }) => (
            <div
              key={href + label}
              onClick={() => router.push(href)}
              style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '1.25rem', cursor: 'pointer', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#06b6d4')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#334155')}
            >
              <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{icon}</span>
              <div>
                <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.9rem', marginBottom: '0.3rem' }}>{label}</div>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <p style={{ color: '#475569', fontSize: '0.75rem', marginTop: '2rem' }}>
          Note: Dedicated broker module routes will be progressively migrated from /admin/* to /broker/* in Phase 3 (Workspace Separation).
        </p>
      </div>
    </ProtectedRoute>
  );
}
