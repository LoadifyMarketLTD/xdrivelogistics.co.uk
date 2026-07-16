'use client';

import type { ReactNode, CSSProperties } from 'react';

interface XdCardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Remove the default padding — useful when the card hosts a full-bleed header */
  noPadding?: boolean;
  /** Lift the card slightly on hover */
  hoverable?: boolean;
  onClick?: () => void;
}

/**
 * XdCard — canonical surface component.
 *
 * Uses CSS custom properties so it automatically picks up the single
 * design-token system defined in globals.css / tailwind.config.js.
 *
 * Padding   : 16px (--sp-4)
 * Radius    : 12px (--radius-lg)
 * Border    : 1px solid --xd-border
 * Background: --xd-surface
 * Shadow    : --shadow-sm
 */
export function XdCard({ children, className = '', style, noPadding = false, hoverable = false, onClick }: XdCardProps) {
  const base: CSSProperties = {
    background: 'var(--xd-surface)',
    border: '1px solid var(--xd-border)',
    borderRadius: 'var(--radius-lg)',
    padding: noPadding ? 0 : 'var(--sp-4)',
    boxShadow: 'var(--shadow-sm)',
    transition: hoverable ? 'box-shadow 0.2s ease, transform 0.2s ease' : undefined,
    cursor: onClick ? 'pointer' : undefined,
    ...style,
  };

  return (
    <div
      className={className}
      style={base}
      onClick={onClick}
      onMouseEnter={hoverable ? (e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
      } : undefined}
      onMouseLeave={hoverable ? (e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
      } : undefined}
    >
      {children}
    </div>
  );
}

interface XdCardHeaderProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Canonical card header with bottom border and consistent spacing */
export function XdCardHeader({ children, className = '', style }: XdCardHeaderProps) {
  return (
    <div
      className={className}
      style={{
        padding: 'var(--sp-4)',
        borderBottom: '1px solid var(--xd-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--sp-2)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

interface XdCardBodyProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Canonical card body — adds padding when the card itself has noPadding */
export function XdCardBody({ children, className = '', style }: XdCardBodyProps) {
  return (
    <div className={className} style={{ padding: 'var(--sp-4)', ...style }}>
      {children}
    </div>
  );
}
