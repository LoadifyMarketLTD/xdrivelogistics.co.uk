'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';

const THEME = {
  pageBg: '#0f172a',
  cardBg: '#1e293b',
  cardBorder: '#334155',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#f59e0b',
};

interface SuperAdminModulePageProps {
  title: string;
  description: string;
  section: string;
  icon?: string;
  children?: ReactNode;
}

export default function SuperAdminModulePage({
  title,
  description,
  section,
  icon = '🧩',
  children,
}: SuperAdminModulePageProps) {
  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>{icon}</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: THEME.text, margin: 0 }}>{title}</h1>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: THEME.accent, backgroundColor: 'rgba(245,158,11,0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                {section}
              </span>
            </div>
            <p style={{ color: THEME.muted, margin: '0.25rem 0 0', fontSize: '0.85rem' }}>{description}</p>
          </div>
        </div>

        {children ?? (
          <div style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '12px', padding: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ backgroundColor: '#0b1220', border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px', padding: '0.65rem', color: THEME.muted, fontSize: '0.8rem' }}>
                Filters and search area
              </div>
              <div style={{ backgroundColor: '#0b1220', border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px', padding: '0.65rem', color: THEME.muted, fontSize: '0.8rem' }}>
                Status chips
              </div>
              <button style={{ backgroundColor: THEME.accent, color: '#0f172a', border: 'none', borderRadius: '8px', padding: '0.6rem 0.9rem', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>
                Export
              </button>
            </div>

            <div style={{ backgroundColor: '#0b1220', border: `1px solid ${THEME.cardBorder}`, borderRadius: '10px', minHeight: '280px', marginBottom: '1rem', padding: '1rem', color: THEME.muted, fontSize: '0.85rem' }}>
              Platform-wide list/table placeholder
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ backgroundColor: '#0b1220', border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px', padding: '0.75rem', color: THEME.muted, fontSize: '0.8rem' }}>
                Bulk actions toolbar
              </div>
              <div style={{ backgroundColor: '#0b1220', border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px', padding: '0.75rem', color: THEME.muted, fontSize: '0.8rem' }}>
                Audit trail + pagination
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

export function BackToSuperAdminButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push('/super-admin')}
      style={{ padding: '0.5rem 1rem', backgroundColor: THEME.accent, color: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
    >
      ← Back to Dashboard
    </button>
  );
}
