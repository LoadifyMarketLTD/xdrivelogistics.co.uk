'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const THEME = {
  pageBg: '#0f172a',
  cardBg: '#1e293b',
  cardBorder: '#334155',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#f59e0b',
  green: '#22c55e',
  red: '#ef4444',
  blue: '#3b82f6',
};

type UserRow = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  status?: string;
  role: string;
  company?: string;
  company_id?: string | null;
  availability_status?: string;
  app_access?: boolean;
  phone?: string;
  created_at: string;
};

type ApiResponse = {
  rows: UserRow[];
  total: number;
  totalDrivers?: number;
  roleCounts?: Record<string, number>;
};

const fmt = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

const statusDot = (status: string | undefined) => {
  const s = (status ?? '').toLowerCase();
  const color =
    s === 'active' || s === 'available'
      ? THEME.green
      : s === 'suspended' || s === 'inactive' || s === 'busy'
        ? THEME.red
        : THEME.muted;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        fontSize: '0.75rem',
        color,
        fontWeight: 600,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          backgroundColor: color,
          display: 'inline-block',
        }}
      />
      {s || '—'}
    </span>
  );
};

type SuperAdminUserListPageProps = {
  icon: string;
  title: string;
  description: string;
  section: string;
  roleFilter: string;
  columns: Array<{
    label: string;
    render: (row: UserRow) => React.ReactNode;
  }>;
};

export default function SuperAdminUserListPage({
  icon,
  title,
  description,
  section,
  roleFilter,
  columns,
}: SuperAdminUserListPageProps) {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        setError('No active session.');
        setLoading(false);
        return;
      }

      const url = roleFilter
        ? `/api/super-admin/users?role=${encodeURIComponent(roleFilter)}&limit=500`
        : '/api/super-admin/users?limit=500';

      const res = await fetch(url, { headers: { Authorization: auth } });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `HTTP ${res.status}`);
        setLoading(false);
        return;
      }

      const data = (await res.json()) as ApiResponse;
      setRows(data.rows ?? []);
      setTotal(data.total ?? data.rows?.length ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed.');
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const filtered = search.trim()
    ? rows.filter((row) =>
        [row.name, row.email, row.company ?? '', row.role].some((f) =>
          f.toLowerCase().includes(search.toLowerCase())
        )
      )
    : rows;

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '1.5rem' }}>{icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: THEME.text, margin: 0 }}>
                {title}
              </h1>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: THEME.accent,
                  backgroundColor: 'rgba(245,158,11,0.12)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                }}
              >
                {section}
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  color: THEME.muted,
                  backgroundColor: '#0b1220',
                  border: `1px solid ${THEME.cardBorder}`,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                }}
              >
                {loading ? '…' : `${total} total`}
              </span>
            </div>
            <p style={{ color: THEME.muted, margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
              {description}
            </p>
          </div>
          <button
            onClick={() => void fetchUsers()}
            disabled={loading}
            style={{
              padding: '0.45rem 1rem',
              backgroundColor: THEME.accent,
              color: '#0f172a',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.78rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              backgroundColor: 'rgba(239,68,68,0.1)',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              padding: '0.65rem 0.9rem',
              color: '#ef4444',
              fontSize: '0.82rem',
              marginBottom: '1rem',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Search */}
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name, email or company…"
            style={{
              width: '100%',
              maxWidth: '360px',
              border: `1px solid ${THEME.cardBorder}`,
              borderRadius: '8px',
              padding: '0.5rem 0.75rem',
              backgroundColor: '#0b1220',
              color: THEME.text,
              fontSize: '0.82rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Table */}
        <div
          style={{
            backgroundColor: THEME.cardBg,
            border: `1px solid ${THEME.cardBorder}`,
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#0b1220' }}>
                  {columns.map((col) => (
                    <th
                      key={col.label}
                      style={{
                        padding: '0.65rem 0.9rem',
                        textAlign: 'left',
                        color: THEME.accent,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        fontSize: '0.68rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      style={{ padding: '2rem', textAlign: 'center', color: THEME.muted }}
                    >
                      Loading {title.toLowerCase()}…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      style={{ padding: '2rem', textAlign: 'center', color: THEME.muted }}
                    >
                      {search ? 'No results match the filter.' : `No ${title.toLowerCase()} found.`}
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr
                      key={row.id}
                      style={{
                        borderTop: `1px solid ${THEME.cardBorder}`,
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#1a2744')
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = '')
                      }
                    >
                      {columns.map((col) => (
                        <td
                          key={col.label}
                          style={{
                            padding: '0.6rem 0.9rem',
                            color: THEME.text,
                            verticalAlign: 'middle',
                          }}
                        >
                          {col.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {filtered.length > 0 && (
          <div style={{ marginTop: '0.5rem', color: THEME.muted, fontSize: '0.72rem' }}>
            Showing {filtered.length} of {total} records.
            {search && ` (filtered from ${rows.length})`}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

// Export helpers for use in pages
export { statusDot, fmt };
