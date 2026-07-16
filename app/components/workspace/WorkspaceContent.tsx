'use client';

import type { CSSProperties, ReactNode } from 'react';
import { WS_CONTENT_PAD } from './tokens';

const contentStyle: CSSProperties = {
  padding: WS_CONTENT_PAD,
  flex: 1,
};

/** Padded content area that sits below WorkspaceHeader inside WorkspaceMain. */
export default function WorkspaceContent({ children }: { children: ReactNode }) {
  return <div style={contentStyle}>{children}</div>;
}
