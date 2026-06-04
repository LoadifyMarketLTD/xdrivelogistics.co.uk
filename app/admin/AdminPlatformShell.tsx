'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthContext';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  broker: 'Broker',
  company_admin: 'Company Admin',
  company_staff: 'Dispatcher',
  driver: 'Driver',
  customer: 'Customer',
};

export default function AdminPlatformShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [companyName, setCompanyName] = useState<string | null>(null);

  const isAdminHome = pathname === '/admin';
  const role = user?.role ?? null;
  const roleLabel = role ? (ROLE_LABEL[role] ?? role) : null;

  useEffect(() => {
    if (!user?.companyId || !isSupabaseConfigured) return;
    let cancelled = false;
    supabase
      .from('companies')
      .select('name')
      .eq('id', user.companyId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.name) setCompanyName(data.name as string);
      });
    return () => { cancelled = true; };
  }, [user?.companyId]);

  if (isAdminHome) {
    return <>{children}</>;
  }

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Slim context bar — company name, role badge, back link */}
      <div
        style={{
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
          padding: '0.5rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.82rem' }}>
          {companyName && (
            <span style={{ fontWeight: 700, color: '#0f172a' }}>{companyName}</span>
          )}
          {companyName && roleLabel && (
            <span style={{ color: '#cbd5e1' }}>·</span>
          )}
          {roleLabel && (
            <span
              style={{
                backgroundColor: '#f1f5f9',
                color: '#475569',
                padding: '0.15rem 0.6rem',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              {roleLabel}
            </span>
          )}
        </div>
        <button
          onClick={() => router.push('/admin')}
          style={{
            padding: '0.35rem 0.75rem',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            background: '#ffffff',
            color: '#64748b',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.78rem',
            whiteSpace: 'nowrap',
          }}
        >
          ← Platform Home
        </button>
      </div>

      {children}
    </div>
  );
}
