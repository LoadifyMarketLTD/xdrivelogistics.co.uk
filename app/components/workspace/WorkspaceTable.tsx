'use client';

import type { CSSProperties, ComponentPropsWithoutRef, ReactNode } from 'react';
import { WS_SURFACE, WS_BORDER, WS_SURFACE_HEAD, WS_TEXT_MUTED, WS_BORDER_LIGHT, WS_BORDER_INPUT } from './tokens';

export interface WorkspacePaginationProps {
  /** 0-indexed current page */
  page: number;
  /** Total number of items */
  total: number;
  perPage: number;
  onPrev: () => void;
  onNext: () => void;
}

interface Props {
  /** Column header labels */
  columns: string[];
  /** <tr> elements for the tbody */
  children: ReactNode;
  /** Minimum table width before horizontal scroll kicks in (default '820px') */
  minWidth?: string;
  pagination?: WorkspacePaginationProps;
}

const wrapStyle: CSSProperties = {
  background: WS_SURFACE,
  borderRadius: '8px',
  border: `1px solid ${WS_BORDER}`,
  overflow: 'hidden',
};

const thStyle: CSSProperties = {
  padding: '0.6rem 0.85rem',
  textAlign: 'left',
  fontSize: '0.7rem',
  fontWeight: 700,
  color: WS_TEXT_MUTED,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const theadRowStyle: CSSProperties = {
  background: WS_SURFACE_HEAD,
  borderBottom: `1px solid ${WS_BORDER}`,
};

/**
 * Standard workspace table.
 * Pass column headers as `columns` and <tr> elements as children (tbody rows).
 */
export default function WorkspaceTable({ columns, children, minWidth = '820px', pagination }: Props) {
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.perPage)) : 1;
  const safePage   = pagination ? Math.min(pagination.page, totalPages - 1) : 0;

  return (
    <div style={wrapStyle}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={theadRowStyle}>
              {columns.map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>

      {pagination && pagination.total > pagination.perPage && (
        <div style={{ borderTop: `1px solid ${WS_BORDER}`, padding: '0.6rem 0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: WS_TEXT_MUTED }}>
          <span>
            Showing {safePage * pagination.perPage + 1}–{Math.min((safePage + 1) * pagination.perPage, pagination.total)} of {pagination.total}
          </span>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              onClick={pagination.onPrev}
              disabled={safePage === 0}
              style={{ padding: '0.28rem 0.65rem', border: `1px solid ${WS_BORDER_INPUT}`, borderRadius: '6px', background: safePage === 0 ? WS_SURFACE_HEAD : WS_SURFACE, cursor: safePage === 0 ? 'not-allowed' : 'pointer' }}
            >
              Previous
            </button>
            <button
              onClick={pagination.onNext}
              disabled={safePage >= totalPages - 1}
              style={{ padding: '0.28rem 0.65rem', border: `1px solid ${WS_BORDER_INPUT}`, borderRadius: '6px', background: safePage >= totalPages - 1 ? WS_SURFACE_HEAD : WS_SURFACE, cursor: safePage >= totalPages - 1 ? 'not-allowed' : 'pointer' }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Standard tbody <tr> — applies light bottom border between rows */
export function WorkspaceTableTr({ children, last, style, ...props }: ComponentPropsWithoutRef<'tr'> & { children: ReactNode; last?: boolean }) {
  return (
    <tr
      {...props}
      style={{ borderBottom: last ? 'none' : `1px solid ${WS_BORDER_LIGHT}`, ...style }}
    >
      {children}
    </tr>
  );
}

/** Standard tbody <td> with canonical padding */
export function WorkspaceTableTd({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return <td style={{ padding: '0.7rem 0.85rem', ...style }}>{children}</td>;
}
