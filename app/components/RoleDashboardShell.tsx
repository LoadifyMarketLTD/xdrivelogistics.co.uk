'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import type { DashboardRoleConfig } from '../../lib/dashboardRegistry';

interface RoleDashboardShellProps {
  roleConfig: DashboardRoleConfig;
  children: ReactNode;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}

export default function RoleDashboardShell({
  roleConfig,
  children,
  title,
  subtitle,
  action,
}: RoleDashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const { user, logout } = useAuth();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#eef2f6', color: '#0f172a' }}>
      <aside style={{ width: '260px', background: '#f8fafc', borderRight: '1px solid #d7e0ea', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #d7e0ea' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: roleConfig.accent, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900 }}>X</div>
            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: 800 }}>{roleConfig.title}</div>
              <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{roleConfig.badge}</div>
            </div>
          </div>
        </div>

        <nav style={{ padding: '0.75rem', display: 'grid', gap: '0.35rem', flex: 1 }}>
          {roleConfig.navItems.map((item) => {
            const active = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/');
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                style={{
                  border: '1px solid',
                  borderColor: active ? roleConfig.accent : '#e2e8f0',
                  borderRadius: '10px',
                  padding: '0.7rem 0.8rem',
                  background: active ? '#eff6ff' : '#fff',
                  color: active ? roleConfig.accent : '#0f172a',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>{item.label}</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.12rem' }}>{item.description}</div>
              </button>
            );
          })}
        </nav>

        <div style={{ padding: '0.9rem', borderTop: '1px solid #d7e0ea' }}>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.4rem' }}>{user?.email ?? 'Signed in'}</div>
          <button onClick={() => void logout()} style={{ width: '100%', borderRadius: '8px', border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', padding: '0.55rem', fontWeight: 800, cursor: 'pointer' }}>Sign out</button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: '1rem 1.1rem 1.4rem' }}>
        <header style={{ background: '#fff', border: '1px solid #d7e0ea', borderRadius: '12px', padding: '1rem 1.1rem', marginBottom: '0.9rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.8rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{roleConfig.badge}</div>
              <h1 style={{ margin: '0.2rem 0 0.25rem', fontSize: '1.35rem', fontWeight: 850, color: '#0f172a' }}>{title ?? roleConfig.title}</h1>
              <p style={{ margin: 0, color: '#475569', maxWidth: '720px', lineHeight: 1.45 }}>{subtitle ?? roleConfig.subtitle}</p>
            </div>
            {action ? <div>{action}</div> : null}
          </div>
          <div style={{ marginTop: '0.75rem', color: roleConfig.accent, fontSize: '0.84rem', fontWeight: 700 }}>{roleConfig.hero}</div>
        </header>
        {children}
      </main>
    </div>
  );
}
