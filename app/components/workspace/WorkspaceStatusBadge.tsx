'use client';

import type { ReactNode } from 'react';

interface Props {
  bg: string;
  color: string;
  children: ReactNode;
}

/**
 * Standard status pill badge.
 * Pass `bg` and `color` from a page-specific status map.
 */
export default function WorkspaceStatusBadge({ bg, color, children }: Props) {
  return (
    <span
      style={{
        background: bg,
        color,
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
