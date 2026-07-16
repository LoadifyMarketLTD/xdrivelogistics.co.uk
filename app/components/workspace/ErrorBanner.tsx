'use client';

import type { CSSProperties } from 'react';

const style: CSSProperties = {
  backgroundColor: 'rgba(245, 163, 0, 0.14)',
  border: '1px solid #F5A300',
  borderRadius: '8px',
  padding: '0.75rem 1rem',
  marginBottom: '1rem',
  color: '#1A1F2B',
  fontSize: '0.88rem',
};

/** Inline error banner — shown above content when a data fetch fails. */
export default function ErrorBanner({ msg }: { msg: string }) {
  return <div style={style}>{msg}</div>;
}
