import type { CSSProperties, ReactNode } from 'react';

interface XdKpiCardProps {
  label: string;
  value: string | number;
  /** Optional lucide icon element or any ReactNode */
  icon?: ReactNode;
  /** Colour accent: 'gold' | 'green' | 'blue' | 'red' | 'muted' */
  tone?: 'gold' | 'green' | 'blue' | 'red' | 'muted';
  subtitle?: string;
  style?: CSSProperties;
  className?: string;
}

const TONE_COLOURS = {
  gold:  'var(--xd-gold)',
  green: 'var(--xd-green)',
  blue:  'var(--xd-blue)',
  red:   'var(--xd-red)',
  muted: 'var(--xd-text-muted)',
};

/**
 * XdKpiCard — canonical KPI / stat metric card.
 *
 * Used on every dashboard (admin, super-admin, driver, customer, broker).
 * Provides consistent label → value hierarchy with optional icon and subtitle.
 *
 * Background: --xd-surface
 * Radius    : --radius-lg (12px)
 * Padding   : --sp-4 (16px)
 */
export function XdKpiCard({ label, value, icon, tone = 'gold', subtitle, style, className = '' }: XdKpiCardProps) {
  const accentColour = TONE_COLOURS[tone];

  return (
    <div
      className={className}
      style={{
        background:   'var(--xd-surface)',
        border:       '1px solid var(--xd-border)',
        borderRadius: 'var(--radius-lg)',
        padding:      'var(--sp-4)',
        minHeight:    '88px',
        display:      'flex',
        flexDirection:'column',
        gap:          'var(--sp-2)',
        position:     'relative',
        overflow:     'hidden',
        ...style,
      }}
    >
      {/* Accent bar */}
      <div style={{
        position:      'absolute',
        top:           0,
        left:          0,
        width:         '3px',
        height:        '100%',
        background:    accentColour,
        borderRadius:  'var(--radius-lg) 0 0 var(--radius-lg)',
        opacity:       0.7,
      }} />

      {/* Label row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', paddingLeft: 'var(--sp-1)' }}>
        {icon && (
          <span style={{ color: accentColour, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {icon}
          </span>
        )}
        <span style={{
          color:         'var(--xd-text-muted)',
          fontSize:      '10px',
          fontWeight:    700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          lineHeight:    1,
        }}>
          {label}
        </span>
      </div>

      {/* Value */}
      <div style={{
        color:      accentColour,
        fontSize:   '1.75rem',
        fontWeight: 800,
        lineHeight: 1,
        paddingLeft:'var(--sp-1)',
      }}>
        {value}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <div style={{
          color:      'var(--xd-text-subtle)',
          fontSize:   '11px',
          lineHeight: 1.3,
          paddingLeft:'var(--sp-1)',
        }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
