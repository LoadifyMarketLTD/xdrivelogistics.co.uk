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
  mutedText: '#64748b',
};

interface PlatformModulePageProps {
  icon: string;
  title: string;
  description: string;
  badge?: string;
  actions?: { label: string; onClick: () => void; primary?: boolean }[];
  children?: ReactNode;
}

export default function PlatformModulePage({
  icon,
  title,
  description,
  badge,
  actions = [],
  children,
}: PlatformModulePageProps) {
  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>{icon}</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: THEME.text, margin: 0 }}>{title}</h1>
                {badge && (
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: THEME.accent, backgroundColor: 'rgba(245,158,11,0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                    {badge}
                  </span>
                )}
              </div>
              <p style={{ color: THEME.muted, margin: '0.25rem 0 0', fontSize: '0.85rem' }}>{description}</p>
            </div>
          </div>
          {actions.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {actions.map((a) => (
                <button
                  key={a.label}
                  onClick={a.onClick}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: a.primary ? THEME.accent : THEME.cardBg,
                    color: a.primary ? '#0f172a' : THEME.text,
                    border: `1px solid ${a.primary ? THEME.accent : THEME.cardBorder}`,
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {children ?? <ComingSoonCard title={title} />}
      </div>
    </ProtectedRoute>
  );
}

function ComingSoonCard({ title }: { title: string }) {
  const router = useRouter();
  return (
    <div style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '12px', padding: '3rem', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔧</div>
      <p style={{ color: THEME.text, fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>{title} module is being built</p>
      <p style={{ color: THEME.muted, fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        This governance module will be populated in upcoming implementation phases.
      </p>
      <button
        onClick={() => router.push('/platform')}
        style={{ padding: '0.5rem 1.25rem', backgroundColor: THEME.accent, color: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
      >
        ← Back to Platform Overview
      </button>
    </div>
  );
}
