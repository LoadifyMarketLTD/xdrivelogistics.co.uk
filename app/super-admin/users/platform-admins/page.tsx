'use client';

import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/app/components/ProtectedRoute';

const THEME = {
  pageBg: '#0f172a',
  cardBg: '#1e293b',
  cardBorder: '#334155',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#f59e0b',
  blue: '#3b82f6',
};

const QUICK_LINKS = [
  { label: 'Roles & Permissions', description: 'Manage platform role assignments and access boundaries.', href: '/super-admin/settings/roles-permissions' },
  { label: 'Audit Logs', description: 'Review all admin actions and platform governance events.', href: '/super-admin/settings/audit-logs' },
  { label: 'Feature Flags', description: 'Toggle platform features and experimental controls.', href: '/super-admin/settings/feature-flags' },
  { label: 'Global Settings', description: 'Core platform configuration and operational parameters.', href: '/super-admin/settings/global' },
];

function PlatformAdminsContent() {
  const router = useRouter();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '1.5rem' }}>🛡️</span>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: THEME.text, margin: 0 }}>Platform Administrators</h1>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: THEME.accent, backgroundColor: 'rgba(245,158,11,0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
              Platform
            </span>
          </div>
          <p style={{ color: THEME.muted, margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
            Platform-level administrator registry and governance controls.
          </p>
        </div>
      </div>

      <div style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
        <h2 style={{ color: THEME.text, fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.5rem' }}>Administrator governance</h2>
        <p style={{ color: THEME.muted, fontSize: '0.82rem', margin: '0 0 1rem', lineHeight: 1.55 }}>
          Platform administrator accounts are managed through Supabase Auth and role assignments in the <strong style={{ color: THEME.accent }}>profiles</strong> table (role = <code style={{ color: THEME.accent }}>&apos;owner&apos;</code> or <code style={{ color: THEME.accent }}>&apos;admin&apos;</code>). Use the governance links below to manage roles and review admin actions.
        </p>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {QUICK_LINKS.map((link) => (
            <button
              key={link.href}
              onClick={() => router.push(link.href)}
              style={{
                textAlign: 'left', cursor: 'pointer', background: '#0b1220',
                border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px',
                padding: '0.75rem 1rem', color: THEME.text, display: 'flex',
                alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.2rem' }}>{link.label}</div>
                <div style={{ color: THEME.muted, fontSize: '0.74rem' }}>{link.description}</div>
              </div>
              <span style={{ color: THEME.blue, fontSize: '0.8rem', flexShrink: 0 }}>→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <PlatformAdminsContent />
    </ProtectedRoute>
  );
}
