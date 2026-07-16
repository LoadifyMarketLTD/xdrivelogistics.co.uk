'use client';

import type { CSSProperties } from 'react';
import { WS_BORDER, WS_SURFACE, WS_TEXT_MUTED } from './tokens';

const style: CSSProperties = {
  backgroundColor: WS_SURFACE,
  borderRadius: '10px',
  border: `1px solid ${WS_BORDER}`,
  padding: '3rem',
  textAlign: 'center',
  color: WS_TEXT_MUTED,
};

/** Full-width loading placeholder — shown while data is fetching. */
export default function LoadingCard({ text }: { text: string }) {
  return <div style={style}>{text}</div>;
}
