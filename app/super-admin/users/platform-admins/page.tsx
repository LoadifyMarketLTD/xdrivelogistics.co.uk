'use client';

import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/app/components/ProtectedRoute';

const THEME = {
  pageBg: '#F4F6F8',
  cardBg: '#FFFFFF',
  cardBorder: '#D9E1EA',
  text: '#1A1F2B',
  heading: '#0B2F6B',
  muted: '#64748B',
  accent: '#F5A300',
  blue: '#1D57D8',
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
    <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '12px' }}>
      <header style={{ minHeight: '52px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '20px' }}>🛡️</span>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: THEME.heading, margin: 0 }}>Platform Administrators</h1>
            <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9A5D00', backgroundColor: '#FFF4DA', padding: '3px 6px', borderRadius: '4px' }}>Platform</span>
          </div>
          <p style={{ color: THEME.muted, margin: '3px 0 0', fontSize: '12px' }}>Platform-level administrator registry and governance controls.</p>
        </div>
      </header>

      <section style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', padding: '12px' }}>
        <h2 style={{ color: THEME.heading, fontSize: '13px', fontWeight: 800, margin: '0 0 4px' }}>Administrator governance</h2>
        <p style={{ color: THEME.text, fontSize: '11px', margin: '0 0 12px', lineHeight: 1.5 }}>
          Platform administrator accounts are managed through Supabase Auth and role assignments in the <strong>profiles</strong> table. Use the governance links below to manage access and review administrative actions.
        </p>
        <div style={{ display: 'grid', gap: '6px' }}>
          {QUICK_LINKS.map((link) => (
            <button
              key={link.href}
              onClick={() => router.push(link.href)}
              style={{
                minHeight: '44px', textAlign: 'left', cursor: 'pointer', background: THEME.cardBg,
                border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px',
                padding: '8px 10px', color: THEME.text, display: 'flex',
                alignItems: 'center', justifyContent: 'space-between', gap: '10px',
              }}
            >
              <div>
                <div style={{ color: THEME.heading, fontWeight: 800, fontSize: '12px', marginBottom: '2px' }}>{link.label}</div>
                <div style={{ color: THEME.muted, fontSize: '10px' }}>{link.description}</div>
              </div>
              <span style={{ color: THEME.blue, fontSize: '12px', flexShrink: 0 }}>→</span>
            </button>
          ))}
        </div>
      </section>
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
