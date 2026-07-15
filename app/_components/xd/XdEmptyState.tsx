import type { CSSProperties, ReactNode } from 'react';

interface XdEmptyStateProps {
  title?: string;
  description?: string;
  /** Optional icon / illustration element */
  icon?: ReactNode;
  /** Optional CTA / action button */
  action?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

/**
 * XdEmptyState — canonical empty-state block.
 *
 * Use whenever a list, table, or dashboard section has no data.
 * Provides a consistent vertical rhythm: icon → title → description → action.
 */
export function XdEmptyState({ title = 'Nothing here yet', description, icon, action, style, className = '' }: XdEmptyStateProps) {
  return (
    <div
      className={className}
      style={{
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        justifyContent:'center',
        gap:           'var(--sp-3)',
        padding:       'var(--sp-12) var(--sp-6)',
        textAlign:     'center',
        ...style,
      }}
    >
      {icon && (
        <div style={{ color: 'var(--xd-text-subtle)', opacity: 0.6 }}>
          {icon}
        </div>
      )}
      <div>
        <p style={{ margin: 0, color: 'var(--xd-text-muted)', fontSize: '14px', fontWeight: 600 }}>
          {title}
        </p>
        {description && (
          <p style={{ margin: '4px 0 0', color: 'var(--xd-text-subtle)', fontSize: '12px', lineHeight: 1.5 }}>
            {description}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

interface XdLoadingStateProps {
  message?: string;
  style?: CSSProperties;
  className?: string;
}

/**
 * XdLoadingState — canonical loading spinner block.
 *
 * Use in place of ad-hoc spinners and "Loading…" text throughout the platform.
 */
export function XdLoadingState({ message = 'Loading…', style, className = '' }: XdLoadingStateProps) {
  return (
    <div
      className={className}
      style={{
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        justifyContent:'center',
        gap:           'var(--sp-3)',
        padding:       'var(--sp-12) var(--sp-6)',
        textAlign:     'center',
        ...style,
      }}
    >
      {/* Spinner */}
      <div style={{
        width:       '28px',
        height:      '28px',
        border:      '3px solid var(--xd-border)',
        borderTop:   '3px solid var(--xd-gold)',
        borderRadius:'50%',
        animation:   'xdSpin 0.7s linear infinite',
      }} />
      <p style={{ margin: 0, color: 'var(--xd-text-muted)', fontSize: '13px' }}>
        {message}
      </p>
    </div>
  );
}
