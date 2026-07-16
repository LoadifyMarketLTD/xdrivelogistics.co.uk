'use client';

import type { CSSProperties, ReactNode } from 'react';

const mainStyle: CSSProperties = {
  flex: 1,
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
};

/**
 * The flex-1 right column inside WorkspaceShell.
 * Renders a <main> tag and stacks WorkspaceHeader + WorkspaceContent.
 */
export default function WorkspaceMain({ children }: { children: ReactNode }) {
  return <main style={mainStyle}>{children}</main>;
}
