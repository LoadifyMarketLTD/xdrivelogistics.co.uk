'use client';

import type { CSSProperties, ReactNode } from 'react';

const baseCardStyle: CSSProperties = {
  background: '#181a20',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '16px',
  padding: '1rem',
  boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
};

export const mobileMutedTextStyle: CSSProperties = {
  color: '#9ca3af',
  fontSize: '0.78rem',
};

export const mobileSectionTitleStyle: CSSProperties = {
  color: '#f8fafc',
  fontSize: '0.82rem',
  fontWeight: 900,
  marginBottom: '0.65rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

export function MobileCard({
  children,
  style,
  highlighted = false,
}: {
  children: ReactNode;
  style?: CSSProperties;
  highlighted?: boolean;
}) {
  return (
    <section
      style={{
        ...baseCardStyle,
        ...(highlighted
          ? { borderColor: '#facc15', background: 'linear-gradient(180deg, #22231c 0%, #181a20 100%)' }
          : null),
        ...style,
      }}
    >
      {children}
    </section>
  );
}

export function MobileSectionTitle({ children }: { children: ReactNode }) {
  return <div style={mobileSectionTitleStyle}>{children}</div>;
}

export function MobileKpiGrid({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>{children}</div>;
}

export function MobileKpiItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '0.7rem' }}>
      <div style={{ color: '#9ca3af', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color: '#fff', fontSize: '0.88rem', fontWeight: 750, marginTop: '0.25rem', lineHeight: 1.25 }}>{value}</div>
    </div>
  );
}
