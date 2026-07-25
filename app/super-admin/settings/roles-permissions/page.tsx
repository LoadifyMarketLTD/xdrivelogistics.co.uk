'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { supabase } from '../../../../lib/supabaseClient';

const THEME = {
  pageBg: '#0f172a', cardBg: '#1e293b', cardBorder: '#334155',
  text: '#f1f5f9', muted: '#94a3b8', accent: '#f59e0b',
};

const ROLES = [
  { role: 'owner', label: '👑 Platform Owner', description: 'Full super-admin access. Can approve/suspend companies, view all data, manage platform settings.', scopes: ['super-admin/*', 'all companies', 'all users', 'all finance', 'all compliance', 'audit logs', 'feature flags'], color: '#f59e0b' },
  { role: 'company_admin', label: '🏢 Company Admin', description: 'Manages own company: drivers, vehicles, jobs, invoices, dispatchers.', scopes: ['company/drivers', 'company/vehicles', 'company/jobs', 'company/invoices', 'company/dispatchers'], color: '#3b82f6' },
  { role: 'admin_staff', label: '👔 Admin Staff', description: 'Company staff with administrative access within their company.', scopes: ['company/jobs', 'company/drivers', 'company/vehicles'], color: '#8b5cf6' },
  { role: 'dispatcher', label: '📡 Dispatcher', description: 'Assigns jobs to drivers, monitors deliveries, manages job workflows.', scopes: ['dispatch/jobs', 'dispatch/allocations', 'dispatch/tracking'], color: '#06b6d4' },
  { role: 'driver', label: '🚚 Driver', description: 'Accepts and manages own job assignments. Can capture POD and update delivery status.', scopes: ['driver/jobs', 'driver/pod', 'driver/profile'], color: '#22c55e' },
  { role: 'customer', label: '📦 Customer', description: 'Can submit quote requests and track their own shipments.', scopes: ['quotes/request', 'quotes/track'], color: '#94a3b8' },
  { role: 'broker', label: '🤝 Broker', description: 'Can post loads, compare carrier bids, manage carrier network and POD review.', scopes: ['broker/loads', 'broker/bids', 'broker/carriers', 'broker/pod', 'broker/disputes'], color: '#f97316' },
  { role: 'viewer', label: '👁️ Viewer', description: 'Read-only access to assigned company resources.', scopes: ['read-only'], color: '#64748b' },
];

type RoleStats = { role: string; member_count: number; company_count: number };

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function RolesPermissionsPage() {
  const [stats, setStats] = useState<RoleStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const token = await getToken();
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch('/api/super-admin/users?role=all', { headers });
    const body = await res.json().catch(() => ({})) as { users?: { role: string; company_id?: string }[]; error?: string };
    if (!res.ok) { setError(body.error ?? 'Failed to load role stats.'); setLoading(false); return; }
    const users = body.users ?? [];
    const aggregated: Record<string, { members: Set<string>; companies: Set<string> }> = {};
    users.forEach((u) => {
      const r = u.role ?? 'unknown';
      if (!aggregated[r]) aggregated[r] = { members: new Set(), companies: new Set() };
      aggregated[r].members.add(JSON.stringify(u));
      if (u.company_id) aggregated[r].companies.add(u.company_id);
    });
    setStats(Object.entries(aggregated).map(([role, d]) => ({ role, member_count: d.members.size, company_count: d.companies.size })));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const getStats = (role: string) => stats.find((s) => s.role === role);

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', background: THEME.pageBg, color: THEME.text, padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: THEME.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Platform</div>
              <h1 style={{ margin: '0.25rem 0 0', fontSize: '1.6rem', fontWeight: 800 }}>Roles &amp; Permissions</h1>
            </div>
            <button onClick={() => void load()} style={{ background: 'transparent', border: `1px solid ${THEME.cardBorder}`, borderRadius: '6px', color: THEME.muted, padding: '0.4rem 0.8rem', fontSize: '0.78rem', cursor: 'pointer' }}>
              ↻ Refresh
            </button>
          </div>

          <div style={{ fontSize: '0.78rem', color: THEME.muted, marginBottom: '1.25rem', background: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px', padding: '0.75rem 1rem' }}>
            Platform roles are enforced via Supabase RLS policies. Member counts show live data from company_memberships.
            Full permission-matrix editing is a future phase; this view provides observability.
          </div>

          {error && <div style={{ background: '#2d1414', border: '1px solid #7f1d1d', color: '#fca5a5', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.83rem' }}>{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '0.75rem' }}>
            {ROLES.map((r) => {
              const s = getStats(r.role);
              return (
                <div key={r.role} style={{ background: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '10px', padding: '1rem 1.1rem', borderLeft: `3px solid ${r.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{r.label}</div>
                    <div style={{ fontSize: '0.7rem', color: THEME.muted, textAlign: 'right' }}>
                      {loading ? <span style={{ opacity: 0.5 }}>Loading…</span> : s ? <><span style={{ color: r.color, fontWeight: 700 }}>{s.member_count}</span> members / <span style={{ color: THEME.muted }}>{s.company_count} cos</span></> : <span style={{ opacity: 0.4 }}>no active members</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.77rem', color: THEME.muted, marginBottom: '0.6rem' }}>{r.description}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {r.scopes.map((sc) => (
                      <span key={sc} style={{ fontSize: '0.65rem', fontFamily: 'monospace', background: '#0f172a', border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', padding: '0.15rem 0.4rem', color: THEME.muted }}>{sc}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
