'use client';

import type { CSSProperties, ReactNode } from 'react';
import { WS_PAGE_BG, WS_HEADER_H } from './tokens';

interface Props {
  children: ReactNode;
}

const shellStyle: CSSProperties = {
  display: 'flex',
  height: `calc(100vh - ${WS_HEADER_H})`,
  overflow: 'hidden',
  background: WS_PAGE_BG,
};

/** Outer flex shell for every workspace page. Wrap with <ProtectedRoute> before this. */
export default function WorkspaceShell({ children }: Props) {
  return <div style={shellStyle}>{children}</div>;
}
