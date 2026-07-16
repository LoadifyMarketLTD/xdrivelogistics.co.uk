'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import { SUPER_ADMIN_THEME, superAdminCardStyle } from './superAdminTheme';

type TableColumn<T extends Record<string, unknown>> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
};

type SuperAdminLiveTablePageProps<T extends Record<string, unknown>> = {
  icon: string;
  title: string;
  sectionLabel: string;
  description: string;
  endpoint: string;
  rowsField?: string;
  summaryField?: string;
  noteField?: string;
  columns: TableColumn<T>[];
  emptyMessage: string;
};

const THEME = {
  pageBg:     SUPER_ADMIN_THEME.pageBg,
  cardBg:     SUPER_ADMIN_THEME.cardBg,
  cardBorder: SUPER_ADMIN_THEME.cardBorder,
  text:       SUPER_ADMIN_THEME.text,
  muted:      SUPER_ADMIN_THEME.muted,
  accent:     SUPER_ADMIN_THEME.primary,
  red:        SUPER_ADMIN_THEME.danger,
};

export default function SuperAdminLiveTablePage<T extends Record<string, unknown>>({
  icon,
  title,
  sectionLabel,
  description,
  endpoint,
  rowsField = 'rows',
  summaryField,
  noteField,
  columns,
  emptyMessage,
}: SuperAdminLiveTablePageProps<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const stableColumns = useMemo(() => columns, [columns]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const auth = await getAuthHeader();
        if (!auth) {
          setError('No active session.');
          setLoading(false);
          return;
        }

        const res = await fetch(endpoint, { headers: { Authorization: auth } });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError((body as { error?: string }).error ?? `HTTP ${res.status}`);
          setLoading(false);
          return;
        }

        const fieldValue = (body as Record<string, unknown>)[rowsField];
        setRows(Array.isArray(fieldValue) ? (fieldValue as T[]) : []);

        if (summaryField) {
          const summaryValue = (body as Record<string, unknown>)[summaryField];
          setSummary(summaryValue && typeof summaryValue === 'object' ? (summaryValue as Record<string, unknown>) : null);
        }
        if (noteField) {
          const noteValue = (body as Record<string, unknown>)[noteField];
          setNote(typeof noteValue === 'string' ? noteValue : null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fetch failed.');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [endpoint, rowsField, summaryField, noteField]);

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.25rem' }}>
        <div style={{ ...superAdminCardStyle, display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', padding: '1rem 1.1rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.5rem' }}>{icon}</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: THEME.text, margin: 0 }}>{title}</h1>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: THEME.accent, backgroundColor: SUPER_ADMIN_THEME.primarySoft, padding: '0.18rem 0.5rem', borderRadius: '999px' }}>
                {sectionLabel}
              </span>
            </div>
            <p style={{ color: THEME.muted, margin: '0.25rem 0 0', fontSize: '0.85rem' }}>{description}</p>
          </div>
        </div>

        {error && (
          <div style={{ backgroundColor: 'rgba(245, 163, 0, 0.1)', border: `1px solid ${THEME.red}`, borderRadius: '8px', padding: '0.65rem 0.9rem', color: THEME.red, fontSize: '0.82rem', marginBottom: '1rem' }}>
            ⚠️ {error}
          </div>
        )}

        {note && !loading && (
          <div style={{ backgroundColor: SUPER_ADMIN_THEME.primarySurface, border: `1px solid ${SUPER_ADMIN_THEME.primarySoft}`, borderRadius: '8px', padding: '0.65rem 0.9rem', color: THEME.accent, fontSize: '0.8rem', marginBottom: '1rem' }}>
            ℹ️ {note}
          </div>
        )}

        {summary && !loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
            {Object.entries(summary).map(([key, value]) => (
              <div key={key} style={{ ...superAdminCardStyle, boxShadow: 'none', padding: '0.6rem 0.75rem' }}>
                <div style={{ color: THEME.text, fontSize: '1rem', fontWeight: 700 }}>
                  {typeof value === 'number'
                    ? key.toLowerCase().includes('amount') || key.toLowerCase().includes('revenue') || key.toLowerCase().includes('vat') || key.toLowerCase().includes('net')
                      ? `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : key.toLowerCase().includes('rate')
                        ? `${value}%`
                        : value.toLocaleString()
                    : String(value ?? '—')}
                </div>
                <div style={{ color: THEME.muted, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '0.15rem' }}>
                  {key.replace(/_/g, ' ')}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ ...superAdminCardStyle, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: THEME.muted, fontSize: '0.88rem' }}>Loading…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: THEME.muted, fontSize: '0.88rem' }}>{emptyMessage}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '880px', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${THEME.cardBorder}`, backgroundColor: '#F4F6F8' }}>
                    {stableColumns.map((column) => (
                      <th
                        key={column.key}
                        style={{
                          padding: '0.75rem 0.9rem',
                          textAlign: 'left',
                          color: THEME.muted,
                          fontWeight: 600,
                          fontSize: '0.72rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={String((row as { id?: string }).id ?? rowIndex)} style={{ borderBottom: `1px solid ${THEME.cardBorder}` }}>
                      {stableColumns.map((column) => (
                        <td key={column.key} style={{ padding: '0.75rem 0.9rem', color: THEME.text, verticalAlign: 'top' }}>
                          {column.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
