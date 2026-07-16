'use client';

import type { CSSProperties } from 'react';
import { WS_TEXT_PRIMARY, WS_TEXT_SUBTLE } from './tokens';

interface Props {
  label: string;
  value: string | number;
}

const labelStyle: CSSProperties = {
  fontSize: '0.68rem',
  fontWeight: 700,
  color: WS_TEXT_SUBTLE,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '0.05rem',
};

const valueStyle: CSSProperties = {
  fontSize: '1.05rem',
  fontWeight: 800,
  color: WS_TEXT_PRIMARY,
};

/**
 * Metric display row used in WorkspaceAside panels.
 * Renders a label (small-caps, muted) above a large bold value.
 */
export default function WorkspaceMetricCard({ label, value }: Props) {
  return (
    <div style={{ marginBottom: '0.55rem' }}>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{value}</div>
    </div>
  );
}
