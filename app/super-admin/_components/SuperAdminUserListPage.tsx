'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import PlatformEntityLink from '@/app/super-admin/_components/control-plane/PlatformEntityLink';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const X = {
  blue: '#1A73E8', navy: '#1A73E8', yellow: '#FBBC05', white: '#FFFFFF',
  charcoal: '#4A4A4A', light: '#F5F7FA', border: '#E0E3E7', muted: '#4A4A4A',
  green: '#34A853', red: '#EA4335', grey: '#8A9099', shadow: '0px 2px 6px rgba(0,0,0,0.08)',
} as const;
const PAGE_SIZE = 50;

type UserRow = { id: string; user_id: string | null; name: string; email: string; status?: string; role: string; company?: string; company_id?: string | null; availability_status?: string; app_access?: boolean; phone?: string; created_at: string; };
type Pagination = { page: number; limit: number; total: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean; };
type ApiResponse = { rows: UserRow[]; total: number; pagination?: Pagination; };
type SuperAdminUserListPageProps = { icon: string; title: string; description: string; section: string; roleFilter: string; columns: Array<{ label: string; render: (row: UserRow) => ReactNode; }>; };

const fmt = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const statusDot = (status: string | undefined) => {
  const s = (status ?? '').toLowerCase();
  const color = s === 'active' || s === 'available' ? X.green : s === 'suspended' || s === 'inactive' ? X.red : s === 'busy' ? X.blue : X.grey;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: 14, color, fontWeight: 700 }}><span style={{ width: 9, height: 9, borderRadius: '8px', backgroundColor: color, display: 'inline-block' }} />{s || '—'}</span>;
};

export default function SuperAdminUserListPage({ icon, title, description, section, roleFilter, columns }: SuperAdminUserListPageProps) {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true); setError(null); setRows([]); setTotal(0); setHasNextPage(false);
    try {
      const auth = await getAuthHeader(); if (!auth) { setError('No active Platform Owner session.'); return; }
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) }); if (roleFilter) params.set('role', roleFilter);
      const res = await fetch(`/api/super-admin/users?${params.toString()}`, { headers: { Authorization: auth }, cache: 'no-store' });
      const body = await res.json().catch(() => ({})); if (!res.ok) { setError((body as { error?: string }).error ?? 'User service is currently unavailable.'); return; }
      const data = body as Partial<ApiResponse>;
      const nextRows = data.rows ?? [];
      const nextTotal = data.total ?? 0;
      setRows(nextRows); setTotal(nextTotal); setHasNextPage(data.pagination?.hasNextPage ?? page * PAGE_SIZE < nextTotal);
    } catch { setError('User service is currently unavailable.'); }
    finally { setLoading(false); }
  }, [page, roleFilter]);

  useEffect(() => { void fetchUsers(); }, [fetchUsers]);
  useEffect(() => { setPage(1); setFilter(''); }, [roleFilter]);
  const filtered = useMemo(() => { const term = filter.trim().toLowerCase(); if (!term) return rows; return rows.filter(row => [row.name, row.email, row.company ?? '', row.role].some(value => value.toLowerCase().includes(term))); }, [filter, rows]);
  const columnCount = columns.length + 1;

  return <ProtectedRoute allowedRoles={['owner']}><div style={{ minHeight: '100vh', background: X.light, color: X.charcoal, padding: 24, fontFamily: 'Roboto, Inter, Arial, sans-serif', fontSize: 14 }}>
    <header style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
      <span aria-hidden='true' style={{ width: 24, height: 24, display: 'grid', placeItems: 'center', borderRadius: 8, background: X.blue, color: X.white, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: 16, fontWeight: 700 }}>{icon}</span>
      <div style={{ flex: 1 }}><div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}><h1 style={{ margin: 0, color: X.blue, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: 20, lineHeight: 1.25, fontWeight: 700 }}>{title}</h1><span style={{ padding: '4px 8px', borderRadius: 8, background: X.light, color: X.blue, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: 14, fontWeight: 700, textTransform: 'uppercase' }}>{section}</span><span style={{ fontSize: 14, color: X.muted }}>{loading ? '…' : error ? 'Unavailable' : `${total.toLocaleString()} total`}</span></div><p style={{ margin: '6px 0 0', color: X.muted, fontSize: 14 }}>{description}</p></div>
      <button onClick={() => void fetchUsers()} disabled={loading} style={{ minHeight: 40, padding: '0 14px', background: X.blue, color: X.white, border: `1px solid ${X.blue}`, borderRadius: 8, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .65 : 1 }}>{loading ? 'Loading…' : 'Refresh'}</button>
    </header>
    {error && <div role='alert' style={{ marginBottom: 24, border: `1px solid ${X.red}`, borderLeft: `4px solid ${X.red}`, borderRadius: 8, background: X.white, padding: 24, color: X.red, fontSize: 14, fontWeight: 700, boxShadow: X.shadow }}>{error}</div>}
    {!error && <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}><input type='text' value={filter} onChange={event => setFilter(event.target.value)} placeholder='Filter current page by name, email or company…' aria-label='Filter current page' style={{ width: '100%', maxWidth: 420, minHeight: 40, border: `1px solid ${X.border}`, borderRadius: 8, padding: '0 12px', background: X.white, color: X.charcoal, fontFamily: 'Roboto, Inter, Arial, sans-serif', fontSize: 14, boxSizing: 'border-box', outlineColor: X.blue }} /><span style={{ color: X.muted, fontSize: 14 }}>Page {page} · server-side pagination</span></div>
      <section style={{ background: X.white, border: `1px solid ${X.border}`, borderRadius: 8, overflow: 'hidden', boxShadow: X.shadow }}><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}><thead><tr style={{ background: X.light, borderBottom: `1px solid ${X.border}` }}>{columns.map(col => <th key={col.label} style={{ padding: 24, textAlign: 'left', color: X.blue, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>{col.label}</th>)}<th style={{ padding: 24, textAlign: 'left', color: X.blue, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>Inspect</th></tr></thead><tbody>{loading ? <tr><td colSpan={columnCount} style={{ padding: 24, textAlign: 'center', color: X.muted }}>Loading {title.toLowerCase()}…</td></tr> : filtered.length === 0 ? <tr><td colSpan={columnCount} style={{ padding: 24, textAlign: 'center', color: X.muted }}>{filter ? 'No records on this page match the filter.' : `No ${title.toLowerCase()} found.`}</td></tr> : filtered.map(row => <tr key={row.id} style={{ borderBottom: `1px solid ${X.border}` }}>{columns.map(col => <td key={col.label} style={{ padding: 24, color: X.charcoal, fontSize: 14, verticalAlign: 'middle' }}>{col.render(row)}</td>)}<td style={{ padding: 24, verticalAlign: 'middle' }}>{row.user_id ? <PlatformEntityLink entityType='user' entityId={row.user_id} compact>Open</PlatformEntityLink> : <span style={{ color: X.muted, fontSize: 14 }}>Invite only</span>}</td></tr>)}</tbody></table></div>
        {!loading && (page > 1 || hasNextPage) && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 24, borderTop: `1px solid ${X.border}`, background: X.light }}><span style={{ color: X.muted, fontSize: 14 }}>Showing {filtered.length} on page {page} · {total.toLocaleString()} total</span><div style={{ display: 'flex', gap: 8 }}><button type='button' onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page <= 1 || loading} style={pagerButton(page <= 1 || loading)}>← Prev</button><button type='button' onClick={() => setPage(current => current + 1)} disabled={!hasNextPage || loading} style={pagerButton(!hasNextPage || loading)}>Next →</button></div></div>}
      </section>
    </>}
  </div></ProtectedRoute>;
}

const pagerButton = (disabled: boolean) => ({ minHeight: 40, padding: '0 14px', borderRadius: 8, border: `1px solid ${X.border}`, background: disabled ? X.light : X.white, color: disabled ? X.grey : X.blue, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: 14, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer' } as const);
export { statusDot, fmt };
