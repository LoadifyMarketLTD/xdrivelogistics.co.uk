'use client';

import type { CSSProperties } from 'react';

const style: CSSProperties = {
  backgroundColor: '#fef2f2',
  border: '1px solid #fca5a5',
  borderRadius: '8px',
  padding: '0.75rem 1rem',
  marginBottom: '1rem',
  color: '#991b1b',
  fontSize: '0.88rem',
};

/** Inline error banner — shown above content when a data fetch fails. */
export default function ErrorBanner({ msg }: { msg: string }) {
  return <div style={style}>{msg}</div>;
}
