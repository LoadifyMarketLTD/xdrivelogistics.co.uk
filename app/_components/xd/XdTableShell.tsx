import type { CSSProperties, ReactNode } from 'react';

interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
}

interface XdTableShellProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  rows: T[];
  /** Unique key extractor — defaults to row.id */
  rowKey?: (row: T) => string;
  emptyMessage?: string;
  loading?: boolean;
  style?: CSSProperties;
  className?: string;
}

/**
 * XdTableShell — canonical table wrapper.
 *
 * Provides uniform:
 *   - Header: dark surface, uppercase labels, 40px height
 *   - Rows: 44px height, hover state, bottom border
 *   - Empty state: centered message
 *   - Loading state: skeleton rows
 *
 * All padding / colour / typography comes from CSS custom properties.
 * Do not create ad-hoc table styles — use this wrapper everywhere.
 */
export function XdTableShell<T extends Record<string, unknown>>({
  columns,
  rows,
  rowKey = (r) => String(r.id ?? Math.random()),
  emptyMessage = 'No records found.',
  loading = false,
  style,
  className = '',
}: XdTableShellProps<T>) {
  return (
    <div
      className={className}
      style={{
        width:        '100%',
        overflowX:    'auto',
        borderRadius: 'var(--radius-lg)',
        border:       '1px solid var(--xd-border)',
        background:   'var(--xd-surface)',
        ...style,
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '480px' }}>
        {/* ── Header ── */}
        <thead>
          <tr style={{ background: 'var(--xd-surface-2)', borderBottom: '1px solid var(--xd-border)' }}>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding:       '0 12px',
                  height:        '40px',
                  textAlign:     col.align ?? 'left',
                  fontSize:      '10px',
                  fontWeight:    700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color:         'var(--xd-text-muted)',
                  width:         col.width,
                  whiteSpace:    'nowrap',
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>

        {/* ── Body ── */}
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--xd-border)' }}>
                {columns.map((col) => (
                  <td key={col.key} style={{ padding: '12px', height: '44px' }}>
                    <div style={{
                      height:       '12px',
                      borderRadius: 'var(--radius-sm)',
                      background:   'var(--xd-surface-2)',
                      opacity:      0.6,
                      width:        `${50 + Math.random() * 40}%`,
                      animation:    'xdFadeInUp 1s ease infinite alternate',
                    }} />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding:   '48px 24px',
                  textAlign: 'center',
                  color:     'var(--xd-text-subtle)',
                  fontSize:  '13px',
                }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                style={{ borderBottom: '1px solid var(--xd-border)', transition: 'background 0.12s ease' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--xd-surface-2)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding:  '0 12px',
                      height:   '44px',
                      textAlign:col.align ?? 'left',
                      fontSize: '13px',
                      color:    'var(--xd-text)',
                      maxWidth: '280px',
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
  );
}
