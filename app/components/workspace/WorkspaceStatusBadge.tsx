'use client';

import type { ReactNode } from 'react';

interface Props {
  bg?: string;
  color?: string;
  children: ReactNode;
}

const statusStyle = (value: ReactNode) => {
  const status = typeof value === 'string' ? value.toLowerCase().replace(/[\s_-]/g, '') : '';
  if (['active', 'approved', 'completed', 'delivered', 'paid', 'available', 'accepted'].some((item) => status.includes(item))) {
    return { background: 'rgba(29, 87, 216, 0.12)', color: '#0B2F6B', border: '1px solid rgba(29, 87, 216, 0.28)' };
  }
  if (['pending', 'waiting', 'review', 'processing', 'draft'].some((item) => status.includes(item))) {
    return { background: 'rgba(245, 163, 0, 0.14)', color: '#1A1F2B', border: '1px solid rgba(245, 163, 0, 0.34)' };
  }
  if (['cancelled', 'rejected', 'failed', 'error', 'overdue', 'expired', 'disputed', 'offline'].some((item) => status.includes(item))) {
    return { background: 'rgba(245, 163, 0, 0.14)', color: '#1A1F2B', border: '1px solid #F5A300' };
  }
  return null;
};

/**
 * Standard status pill badge.
 * Pass `bg` and `color` from a page-specific status map.
 */
export default function WorkspaceStatusBadge({ bg, color, children }: Props) {
  const semanticStyle = statusStyle(children);
  return (
    <span
      style={{
        background: semanticStyle?.background ?? bg ?? '#F4F6F8',
        color: semanticStyle?.color ?? color ?? '#0B2F6B',
        border: semanticStyle?.border ?? '1px solid rgba(11, 47, 107, 0.16)',
        padding: '0.15rem 0.55rem',
        borderRadius: '12px',
        fontSize: '0.72rem',
        fontWeight: 600,
        display: 'inline-block',
      }}
    >
      {children}
    </span>
  );
}
