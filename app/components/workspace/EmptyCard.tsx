'use client';

import type { CSSProperties } from 'react';
import { WS_SURFACE } from './tokens';

const wrapStyle: CSSProperties = {
  backgroundColor: WS_SURFACE,
  borderRadius: '10px',
  border: '1px solid #e5e7eb',
  padding: '3rem',
  textAlign: 'center',
  color: '#6b7280',
};

/** Full-width empty state — shown when a list has no items. */
export default function EmptyCard({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={wrapStyle}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{icon}</div>
      <p style={{ margin: 0, fontSize: '0.9rem' }}>{text}</p>
    </div>
  );
}
