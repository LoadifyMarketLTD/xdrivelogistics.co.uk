'use client';

import type { ReactNode } from 'react';
import { WS_TEXT_SUBTLE } from './tokens';

/**
 * Small-caps field label used inside WorkspaceAside filter panels
 * and inside modals.
 */
export default function WorkspaceFieldLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: '0.68rem',
        fontWeight: 700,
        color: WS_TEXT_SUBTLE,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        marginBottom: '0.2rem',
      }}
    >
      {children}
    </div>
  );
}
