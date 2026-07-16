'use client';

import type { CSSProperties, ReactNode } from 'react';
import { WS_SURFACE, WS_BORDER, WS_TEXT_PRIMARY, WS_ASIDE_WIDTH } from './tokens';

interface Props {
  title?: string;
  children: ReactNode;
  /** Override width (default 210px) */
  width?: string;
}

const asideBase: CSSProperties = {
  flexShrink: 0,
  background: WS_SURFACE,
  borderRight: `1px solid ${WS_BORDER}`,
  padding: '0.9rem',
  overflowY: 'auto',
  fontSize: '0.78rem',
};

const titleStyle: CSSProperties = {
  fontWeight: 700,
  color: WS_TEXT_PRIMARY,
  marginBottom: '0.75rem',
  fontSize: '0.8rem',
};

/**
 * Left filter / metrics panel.
 * Render directly inside WorkspaceShell before WorkspaceMain.
 */
export default function WorkspaceAside({ title, children, width = WS_ASIDE_WIDTH }: Props) {
  return (
    <aside style={{ ...asideBase, width }}>
      {title && <div style={titleStyle}>{title}</div>}
      {children}
    </aside>
  );
}
