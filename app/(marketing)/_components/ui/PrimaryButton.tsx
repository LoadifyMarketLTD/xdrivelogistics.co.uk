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
  style 
}: PrimaryButtonProps) {
  const baseStyles: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: size === 'lg' ? '1rem 2rem' : '0.875rem 1.75rem',
    fontSize: size === 'lg' ? '1.1rem' : '1rem',
    fontWeight: 'var(--font-weight-semibold)',
    borderRadius: 'var(--radius-lg)',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    textDecoration: 'none',
    ...style,
  };

  const variantStyles: CSSProperties = variant === 'primary'
    ? {
        backgroundColor: 'var(--color-gold-primary)',
        color: 'var(--color-primary-navy-dark)',
      }
    : {
        backgroundColor: 'transparent',
        color: 'var(--color-text-white)',
        border: '2px solid var(--color-text-white)',
      };

  const combinedStyles = { ...baseStyles, ...variantStyles };

  const handleHover = (e: React.MouseEvent<HTMLElement>) => {
    if (variant === 'primary') {
      e.currentTarget.style.backgroundColor = 'var(--color-gold-dark)';
      e.currentTarget.style.transform = 'translateY(-2px)';
    } else {
      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
    if (variant === 'primary') {
      e.currentTarget.style.backgroundColor = 'var(--color-gold-primary)';
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
