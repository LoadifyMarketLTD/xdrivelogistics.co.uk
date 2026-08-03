'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const THEME = {
  pageBg: '#0f172a',
  cardBg: '#1e293b',
  cardBorder: '#334155',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#f59e0b',
  blue: '#3b82f6',
};

type Stats = { driversTotal?: number; companiesTotal?: number };

const USER_SECTIONS = [
  { icon: '🚗', label: 'Drivers', description: 'Platform driver accounts, availability and location.', href: '/super-admin/users/drivers' },
  { icon: '🛡️', label: 'Platform Admins', description: 'Platform-level administrator registry and governance controls.', href: '/super-admin/users/platform-admins' },
  { icon: '🧑‍💼', label: 'Company Owners', description: 'Company owner account registry and authority controls.', href: '/super-admin/users/company-owners' },
  { icon: '🧭', label: 'Dispatchers', description: 'Dispatcher accounts across all companies.', href: '/super-admin/users/dispatchers' },
  { icon: '🛒', label: 'Customers', description: 'Customer accounts and usage footprint across the marketplace.', href: '/super-admin/users/customers' },
];

function AllUsersContent() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const auth = await getAuthHeader();
      if (!auth) return;
      const res = await fetch('/api/super-admin/stats', { headers: { Authorization: auth } });
      if (res.ok) setStats(await res.json() as Stats);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '1.5rem' }}>👥</span>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: THEME.text, margin: 0 }}>All Users</h1>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: THEME.accent, backgroundColor: 'rgba(245,158,11,0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
              Platform
            </span>
          </div>
          <p style={{ color: THEME.muted, margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
            All users across drivers, dispatchers, customers and admins — {loading ? '…' : `${stats?.driversTotal ?? 0} drivers registered`}.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
        {USER_SECTIONS.map((section) => (
          <button
            key={section.href}
            onClick={() => router.push(section.href)}
            style={{
              textAlign: 'left', cursor: 'pointer', background: THEME.cardBg,
              border: `1px solid ${THEME.cardBorder}`, borderTop: `3px solid ${THEME.blue}`,
              borderRadius: '10px', padding: '1rem', color: THEME.text,
            }}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>{section.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.3rem' }}>{section.label}</div>
            <div style={{ color: THEME.muted, fontSize: '0.76rem', lineHeight: 1.45, marginBottom: '0.75rem' }}>{section.description}</div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: THEME.blue }}>Open {section.label} →</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <AllUsersContent />
    </ProtectedRoute>
  );
}
