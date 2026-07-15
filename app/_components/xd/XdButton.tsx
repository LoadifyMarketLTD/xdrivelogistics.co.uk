'use client';

import type { ReactNode, CSSProperties, ButtonHTMLAttributes } from 'react';

type XdButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'success';
type XdButtonSize    = 'sm' | 'md' | 'lg' | 'icon';

interface XdButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  variant?: XdButtonVariant;
  size?: XdButtonSize;
  children: ReactNode;
  loading?: boolean;
  style?: CSSProperties;
}

const BASE: CSSProperties = {
  display:        'inline-flex',
  alignItems:     'center',
  justifyContent: 'center',
  gap:            '6px',
  fontFamily:     'var(--font-family)',
  fontWeight:     'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
  borderRadius:   'var(--radius-md)',
  border:         'none',
  cursor:         'pointer',
  transition:     'background 0.18s ease, box-shadow 0.18s ease, transform 0.12s ease',
  textDecoration: 'none',
  whiteSpace:     'nowrap',
};

const SIZES: Record<XdButtonSize, CSSProperties> = {
  sm:   { height: '28px', padding: '0 10px', fontSize: '12px' },
  md:   { height: '34px', padding: '0 14px', fontSize: '13px' },
  lg:   { height: '42px', padding: '0 20px', fontSize: '14px' },
  icon: { height: '36px', width: '36px', padding: '0', fontSize: '14px' },
};

const VARIANTS: Record<XdButtonVariant, CSSProperties> = {
  primary: {
    background: 'var(--xd-gold)',
    color:      'var(--xd-navy)',
    boxShadow:  '0 1px 4px rgba(245,158,11,0.3)',
  },
  secondary: {
    background: 'var(--xd-surface-2)',
    color:      'var(--xd-text)',
    border:     '1px solid var(--xd-border)',
  },
  ghost: {
    background: 'transparent',
    color:      'var(--xd-text-muted)',
    border:     'none',
  },
  outline: {
    background: 'transparent',
    color:      'var(--xd-gold)',
    border:     '1px solid var(--xd-gold)',
  },
  danger: {
    background: 'var(--xd-red)',
    color:      '#fff',
  },
  success: {
    background: 'var(--xd-green)',
    color:      '#fff',
  },
};

const HOVER: Record<XdButtonVariant, CSSProperties> = {
  primary:   { background: 'var(--xd-gold-dark)', transform: 'translateY(-1px)' },
  secondary: { background: 'var(--xd-border)', transform: 'translateY(-1px)' },
  ghost:     { background: 'rgba(255,255,255,0.06)' },
  outline:   { background: 'rgba(245,158,11,0.1)' },
  danger:    { background: '#dc2626', transform: 'translateY(-1px)' },
  success:   { background: '#16a34a', transform: 'translateY(-1px)' },
};

/**
 * XdButton — canonical action component.
 *
 * Variants : primary | secondary | ghost | outline | danger | success
 * Sizes    : sm (28px) | md (34px) | lg (42px) | icon (36×36px)
 *
 * All dimensions follow the 4px spacing grid.
 * Never create ad-hoc button styles — extend this component instead.
 */
export function XdButton({
  variant = 'primary',
  size = 'md',
  children,
  loading = false,
  style,
  disabled,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: XdButtonProps) {
  const combinedStyle: CSSProperties = {
    ...BASE,
    ...SIZES[size],
    ...VARIANTS[variant],
    opacity: disabled || loading ? 0.55 : 1,
    ...style,
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled && !loading) {
      const hover = HOVER[variant];
      Object.assign(e.currentTarget.style, hover);
    }
    onMouseEnter?.(e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    const reset: CSSProperties = { ...VARIANTS[variant], transform: 'translateY(0)' };
    Object.assign(e.currentTarget.style, reset);
    onMouseLeave?.(e);
  };

  return (
    <button
      {...rest}
      disabled={disabled || loading}
      style={combinedStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {loading ? (
        <>
          <span style={{
            width: '12px',
            height: '12px',
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            display: 'inline-block',
            animation: 'xdSpin 0.7s linear infinite',
          }} />
          {children}
        </>
      ) : children}
    </button>
  );
}
