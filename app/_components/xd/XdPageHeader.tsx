import type { CSSProperties, ReactNode } from 'react';

interface XdPageHeaderProps {
  /** Main page title */
  title: string;
  /** Optional subtitle / description */
  description?: string;
  /** Optional element rendered to the right (buttons, badges, etc.) */
  actions?: ReactNode;
  /** Optional breadcrumb or back-link area */
  breadcrumb?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

/**
 * XdPageHeader — canonical page-level header.
 *
 * Provides a consistent visual anchor at the top of every content page:
 *   [breadcrumb?]
 *   [Title]  ·  [description?]       [actions?]
 *
 * Border-bottom separates the header from the page toolbar / content area.
 * Padding : 16px vertical, 24px horizontal (matches container gutter).
 * Used in admin, super-admin, driver, customer and broker pages.
 */
export function XdPageHeader({ title, description, actions, breadcrumb, style, className = '' }: XdPageHeaderProps) {
  return (
    <header
      className={className}
      style={{
        padding:      'var(--sp-4) var(--sp-6)',
        borderBottom: '1px solid var(--xd-border)',
        background:   'var(--xd-surface)',
        ...style,
      }}
    >
      {breadcrumb && (
        <div style={{
          marginBottom: 'var(--sp-2)',
          color:        'var(--xd-text-muted)',
          fontSize:     '12px',
          display:      'flex',
          alignItems:   'center',
          gap:          'var(--sp-1)',
        }}>
          {breadcrumb}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{
            margin:     0,
            color:      'var(--xd-text)',
            fontSize:   '18px',
            fontWeight: 700,
            lineHeight: 1.2,
          }}>
            {title}
          </h1>
          {description && (
            <p style={{
              margin:    '4px 0 0',
              color:     'var(--xd-text-muted)',
              fontSize:  '13px',
              lineHeight:1.4,
            }}>
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexShrink: 0, flexWrap: 'wrap' }}>
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
