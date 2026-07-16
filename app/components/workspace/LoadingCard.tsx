'use client';

import type { CSSProperties } from 'react';
import { WS_SURFACE } from './tokens';

const style: CSSProperties = {
  backgroundColor: WS_SURFACE,
  borderRadius: '10px',
  border: '1px solid #e5e7eb',
  padding: '3rem',
  textAlign: 'center',
  color: '#6b7280',
};

/** Full-width loading placeholder — shown while data is fetching. */
export default function LoadingCard({ text }: { text: string }) {
  return <div style={style}>{text}</div>;
}
