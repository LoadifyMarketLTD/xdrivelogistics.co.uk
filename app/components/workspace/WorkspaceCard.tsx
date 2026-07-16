'use client';

import type { CSSProperties, ReactNode } from 'react';
import { WS_SURFACE, WS_BORDER, WS_SURFACE_ALT, WS_BORDER_LIGHT } from './tokens';

interface Props {
  children: ReactNode;
  /** Optional top-border accent colour (e.g. #3b82f6 for "has bid") */
  accent?: string;
  /** Optional footer slot — rendered with the standard card footer bar */
  footer?: ReactNode;
}

const footerStyle: CSSProperties = {
  borderTop: `1px solid ${WS_BORDER_LIGHT}`,
  padding: '0.45rem 1rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  background: WS_SURFACE_ALT,
};

/**
 * Operational card — white rounded bordered card with optional accent top border
 * and a footer action row.
 */
export default function WorkspaceCard({ children, accent, footer }: Props) {
  const cardStyle: CSSProperties = {
    background: WS_SURFACE,
    border: `1px solid ${WS_BORDER}`,
    borderTop: accent ? `3px solid ${accent}` : `1px solid ${WS_BORDER}`,
    borderRadius: '6px',
    overflow: 'hidden',
  };

  return (
    <div style={cardStyle}>
      {children}
      {footer != null && <div style={footerStyle}>{footer}</div>}
    </div>
  );
}
