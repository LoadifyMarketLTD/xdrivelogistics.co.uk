import { ReactNode, CSSProperties } from 'react';

interface PrimaryButtonProps {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'secondary';
  size?: 'md' | 'lg';
  style?: CSSProperties;
}

export function PrimaryButton({
  children,
  onClick,
  href,
  variant = 'primary',
  size = 'md',
  style,
}: PrimaryButtonProps) {
  const baseStyles: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: size === 'lg' ? '1rem 2rem' : '0.875rem 1.75rem',
    fontSize: size === 'lg' ? '1.05rem' : '0.95rem',
    fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
    fontFamily: 'var(--font-family)',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textDecoration: 'none',
    ...style,
  };

  const variantStyles: CSSProperties = variant === 'primary'
    ? {
        backgroundColor: 'var(--xd-gold)',
        color: 'var(--xd-navy)',
        boxShadow: '0 2px 12px rgba(245, 163, 0, 0.3)',
      }
    : {
        backgroundColor: 'transparent',
        color: '#FFFFFF',
        border: '2px solid rgba(255, 255, 255, 0.6)',
      };

  const combinedStyles = { ...baseStyles, ...variantStyles };

  const handleHover = (e: React.MouseEvent<HTMLElement>) => {
    if (variant === 'primary') {
      e.currentTarget.style.backgroundColor = 'var(--xd-gold-dark)';
      e.currentTarget.style.transform = 'translateY(-1px)';
    } else {
      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
    if (variant === 'primary') {
      e.currentTarget.style.backgroundColor = 'var(--xd-gold)';
      e.currentTarget.style.transform = 'translateY(0)';
    } else {
      e.currentTarget.style.backgroundColor = 'transparent';
    }
  };

  if (href) {
    return (
      <a
        href={href}
        style={combinedStyles}
        onMouseEnter={handleHover}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      onClick={onClick}
      style={combinedStyles}
      onMouseEnter={handleHover}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </button>
  );
}
