import type { CSSProperties, ReactNode } from 'react';

type XdBadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

interface XdBadgeProps {
  children: ReactNode;
  variant?: XdBadgeVariant;
  size?: 'sm' | 'md';
  style?: CSSProperties;
  className?: string;
}

const BADGE_STYLES: Record<XdBadgeVariant, CSSProperties> = {
  default:  { background: 'var(--xd-surface-2)', color: 'var(--xd-text)',        border: '1px solid var(--xd-border)' },
  primary:  { background: 'var(--xd-gold-subtle)', color: 'var(--xd-gold)',      border: '1px solid rgba(245,158,11,0.3)' },
  success:  { background: 'rgba(34,197,94,0.12)', color: '#22c55e',              border: '1px solid rgba(34,197,94,0.25)' },
  warning:  { background: 'rgba(251,191,36,0.12)', color: '#fbbf24',             border: '1px solid rgba(251,191,36,0.25)' },
  danger:   { background: 'rgba(239,68,68,0.12)', color: '#ef4444',              border: '1px solid rgba(239,68,68,0.25)' },
  info:     { background: 'rgba(59,130,246,0.12)', color: '#60a5fa',             border: '1px solid rgba(59,130,246,0.25)' },
  muted:    { background: 'transparent',           color: 'var(--xd-text-muted)', border: '1px solid var(--xd-border)' },
};

/**
 * XdBadge — canonical status chip / label.
 *
 * Variants: default | primary | success | warning | danger | info | muted
 * Sizes   : sm | md
 *
 * Use this for job statuses, compliance states, document labels, and any
 * other categorical indicator across the platform.
 */
export function XdBadge({ children, variant = 'default', size = 'sm', style, className = '' }: XdBadgeProps) {
  const base: CSSProperties = {
    display:       'inline-flex',
    alignItems:    'center',
    gap:           '4px',
    fontFamily:    'var(--font-family)',
    fontWeight:    600,
    borderRadius:  'var(--radius-sm)',
    lineHeight:    1,
    whiteSpace:    'nowrap',
    letterSpacing: '0.02em',
    ...(size === 'sm' ? { fontSize: '10px', padding: '3px 7px' } : { fontSize: '12px', padding: '4px 10px' }),
    ...BADGE_STYLES[variant],
    ...style,
  };

  return <span className={className} style={base}>{children}</span>;
}

/** Map a raw job/document status string to the correct badge variant */
export function statusToBadgeVariant(status: string): XdBadgeVariant {
  const s = status.toLowerCase().replace(/[_\s-]/g, '');
  if (['active', 'approved', 'delivered', 'completed', 'paid', 'success'].some(v => s.includes(v))) return 'success';
  if (['pending', 'review', 'waiting', 'processing'].some(v => s.includes(v))) return 'warning';
  if (['rejected', 'failed', 'overdue', 'cancelled', 'expired', 'disputed'].some(v => s.includes(v))) return 'danger';
  if (['posted', 'open', 'available'].some(v => s.includes(v))) return 'info';
  if (['allocated', 'assigned', 'intransit', 'inprogress'].some(v => s.includes(v))) return 'primary';
  if (['draft', 'archived'].some(v => s.includes(v))) return 'muted';
  return 'default';
}
