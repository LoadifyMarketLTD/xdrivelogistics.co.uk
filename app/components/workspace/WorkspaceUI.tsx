'use client';

import { isValidElement } from 'react';
import type { CSSProperties, ReactNode, FormEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './WorkspaceUI.module.css';

export const workspaceTheme = {
  page: '#F4F6F8',
  surface: '#ffffff',
  surfaceSoft: '#F4F6F8',
  surfaceMuted: '#F4F6F8',
  border: '#D8DEE8',
  borderStrong: '#D8DEE8',
  divider: '#E5E7EB',
  text: '#1A1F2B',
  muted: '#64748B',
  blue: '#1d57d8',
  navy: '#0b2f6b',
  orange: '#f5a300',
  green: '#35a853',
  red: '#d93025',
  amber: '#d97706',
  purple: '#7c3aed',
};

const compactShadow = 'none';

export function WorkspaceRouteTabs({
  ariaLabel,
  items,
  note,
}: {
  ariaLabel: string;
  items: Array<{ href: string; label: string }>;
  note?: ReactNode;
}) {
  const pathname = usePathname() ?? '';
  const activeHref = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="workspace-tab-strip workspace-route-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const active = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            role="tab"
            aria-selected={active}
            aria-current={active ? 'page' : undefined}
            data-active={active ? 'true' : 'false'}
          >
            {item.label}
          </Link>
        );
      })}
      {note ? <span className="workspace-route-tabs__note">{note}</span> : null}
    </nav>
  );
}

export function PageFrame({ children, maxWidth }: { children: ReactNode; maxWidth?: number }) {
  return (
    <div
      className={`xdrive-page-frame ${styles.pageFrame}`}
      style={typeof maxWidth === 'number' ? { maxWidth } : undefined}
    >
      {children}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions, meta }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; meta?: ReactNode }) {
  return (
    <header className={`xdrive-page-header ${styles.pageHeader}`}>
      <div className={`xdrive-page-header__copy ${styles.pageHeaderCopy}`}>
        {eyebrow && <div className={`xdrive-page-header__eyebrow ${styles.pageHeaderEyebrow}`}>{eyebrow}</div>}
        <h1 className={`xdrive-page-header__title ${styles.pageHeaderTitle}`}>{title}</h1>
        {description && <p className={`xdrive-page-header__description ${styles.pageHeaderDescription}`}>{description}</p>}
        {meta && <div className={`xdrive-page-header__meta ${styles.pageHeaderMeta}`}>{meta}</div>}
      </div>
      {actions && <div className={`xdrive-page-header__actions ${styles.pageHeaderActions}`}>{actions}</div>}
    </header>
  );
}

export function WorkspaceDialog({
  ariaLabel,
  title,
  description,
  children,
  actions,
  headerActions,
  subheader,
  footerLeading,
  onDismiss,
  dismissDisabled = false,
  width = 620,
  maxHeight = 720,
}: {
  ariaLabel: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  headerActions?: ReactNode;
  subheader?: ReactNode;
  footerLeading?: ReactNode;
  onDismiss?: () => void;
  dismissDisabled?: boolean;
  width?: number;
  maxHeight?: number;
}) {
  return (
    <div
      className={styles.workspaceDialogOverlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && onDismiss && !dismissDisabled) onDismiss();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={styles.workspaceDialog}
        style={{
          '--workspace-dialog-max-width': `${width}px`,
          '--workspace-dialog-max-height': `${maxHeight}px`,
        } as CSSProperties}
      >
        <header className={styles.workspaceDialogHeader}>
          <div className={styles.workspaceDialogHeaderCopy}>
            <strong className={styles.workspaceDialogTitle}>{title}</strong>
            {description ? <span className={styles.workspaceDialogDescription}>{description}</span> : null}
          </div>
          {headerActions ? <div className={styles.workspaceDialogHeaderActions}>{headerActions}</div> : null}
        </header>
        {subheader ? <div className={styles.workspaceDialogSubheader}>{subheader}</div> : null}
        <div className={styles.workspaceDialogBody}>{children}</div>
        {actions || footerLeading ? (
          <footer className={styles.workspaceDialogFooter}>
            {footerLeading ? <div className={styles.workspaceDialogFooterLeading}>{footerLeading}</div> : <span />}
            {actions ? <div className={styles.workspaceDialogFooterActions}>{actions}</div> : null}
          </footer>
        ) : null}
      </section>
    </div>
  );
}

export function OperationalToolbar({ children }: { children: ReactNode }) {
  return <div className={styles.operationalToolbar}>{children}</div>;
}

export function ActionButton({ children, onClick, tone = 'primary', disabled = false, type = 'button', title }: { children: ReactNode; onClick?: () => void; tone?: 'primary' | 'success' | 'warning' | 'danger' | 'secondary'; disabled?: boolean; type?: 'button' | 'submit'; title?: string }) {
  const palette = {
    primary: { bg: workspaceTheme.blue, color: '#fff', border: workspaceTheme.blue },
    success: { bg: workspaceTheme.green, color: '#fff', border: workspaceTheme.green },
    warning: { bg: workspaceTheme.orange, color: '#172033', border: workspaceTheme.orange },
    danger: { bg: '#fff', color: workspaceTheme.red, border: '#fecaca' },
    secondary: { bg: '#fff', color: workspaceTheme.text, border: workspaceTheme.borderStrong },
  }[tone];
  return <button className="owner-ref-hook-action-button" title={title} type={type} disabled={disabled} onClick={onClick} style={{ border: `1px solid ${palette.border}`, background: disabled ? '#e2e8f0' : palette.bg, color: disabled ? '#64748b' : palette.color, borderRadius: '4px', padding: '0 12px', height: '32px', fontSize: '12px', fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', boxShadow: tone === 'secondary' || tone === 'danger' ? 'none' : compactShadow, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', whiteSpace: 'nowrap' }}>{children}</button>;
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <ExchangeKpiStrip>{children}</ExchangeKpiStrip>;
}

export function ExchangeKpiStrip({ children }: { children: ReactNode }) {
  return (
    <section className={styles.exchangeKpiStrip} aria-label="Operational key performance indicators">
      {children}
    </section>
  );
}

/** Trend / delta indicator for a KpiCard. Direction controls the arrow glyph; sentiment controls colour. */
export type KpiTrend = {
  /** Display text, e.g. "+12 %" or "−3". */
  delta: string;
  /** Arrow direction only — independent of whether the change is good or bad. */
  direction: 'up' | 'down' | 'neutral';
  /**
   * Semantic presentation tone, derived from the metric's business meaning.
   * An upward movement can be negative (e.g. overdue invoices) and a downward
   * movement can be positive (e.g. incident count). Defaults to `'neutral'`
   * when omitted so that callers must be explicit about good/bad.
   */
  sentiment?: 'positive' | 'negative' | 'neutral';
  /** Optional context label, e.g. "vs last month". */
  label?: string;
};

/** Colour lookup keyed by semantic sentiment, not by arrow direction. */
export const SENTIMENT_COLORS: Record<NonNullable<KpiTrend['sentiment']>, string> = {
  positive: workspaceTheme.green,
  negative: workspaceTheme.red,
  neutral: workspaceTheme.muted,
};

export const TREND_ARROWS: Record<KpiTrend['direction'], string> = {
  up: '↑',
  down: '↓',
  neutral: '→',
};

export type WorkspaceCardTone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'navy';

const WORKSPACE_CARD_TONES: Record<WorkspaceCardTone, string> = {
  blue: workspaceTheme.blue,
  green: workspaceTheme.green,
  orange: workspaceTheme.orange,
  red: workspaceTheme.red,
  purple: workspaceTheme.purple,
  navy: workspaceTheme.navy,
};

function getWorkspaceCardStyle({
  tone,
  interactive,
  minHeight = '72px',
  maxHeight = '80px',
}: {
  tone: WorkspaceCardTone;
  interactive: boolean;
  minHeight?: string;
  maxHeight?: string;
}): CSSProperties {
  return {
    textAlign: 'left',
    background: workspaceTheme.surface,
    border: `1px solid ${workspaceTheme.border}`,
    borderLeft: `3px solid ${WORKSPACE_CARD_TONES[tone]}`,
    borderRadius: '4px',
    padding: '8px 10px',
    minHeight,
    maxHeight,
    boxShadow: compactShadow,
    cursor: interactive ? 'pointer' : 'default',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    overflow: 'hidden',
    width: '100%',
  };
}

export function KpiCard({
  label,
  value,
  detail,
  tone = 'blue',
  onClick,
  icon,
  trend,
  ariaLabel,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: WorkspaceCardTone;
  onClick?: () => void;
  icon?: ReactNode;
  /** Optional trend / delta indicator shown below the value. */
  trend?: KpiTrend;
  /** Accessible label for the card. Defaults to the label text when omitted. */
  ariaLabel?: string;
}) {
  const color = WORKSPACE_CARD_TONES[tone];
  /*
   * Section 8 numeric contract:
   * tile height: 72px target, max 80px
   * padding: 8px 10px
   * label: 11px / 14px / 600
   * value: 22px / 26px / 700
   * accent bar: 3px left border
   * No min-height 100px+.
   */
  const cardStyle = getWorkspaceCardStyle({ tone, interactive: Boolean(onClick) });
  const computedAriaLabel = ariaLabel ?? label;
  const content = (
    <>
      <div style={{ color: workspaceTheme.muted, fontSize: '11px', fontWeight: 600, lineHeight: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
        <span>{label}</span>
        {icon && <span aria-hidden="true" style={{ color, fontSize: '12px', flexShrink: 0 }}>{icon}</span>}
      </div>
      <div style={{ color: workspaceTheme.text, fontSize: '22px', fontWeight: 700, lineHeight: '26px', whiteSpace: 'nowrap' }}>{value}</div>
      {(detail || trend) && (
        <div style={{ fontSize: '11px', lineHeight: '14px', color: workspaceTheme.muted, display: 'flex', alignItems: 'center', gap: '4px' }}>
          {trend && (
            <>
              <span aria-hidden="true" style={{ color: SENTIMENT_COLORS[trend.sentiment ?? 'neutral'], fontWeight: 900 }}>{TREND_ARROWS[trend.direction]}</span>
              <span style={{ color: SENTIMENT_COLORS[trend.sentiment ?? 'neutral'], fontWeight: 700 }}>{trend.delta}</span>
              {trend.label && <span>{trend.label}</span>}
            </>
          )}
          {!trend && detail}
        </div>
      )}
    </>
  );
  if (!onClick) return <div data-workspace-kpi-card="true" role="group" aria-label={computedAriaLabel} style={cardStyle}>{content}</div>;
  return <button data-workspace-kpi-card="true" aria-label={computedAriaLabel} onClick={onClick} type="button" style={cardStyle}>{content}</button>;
}

export function ActionCard({
  label,
  description,
  actionLabel = 'Open',
  tone = 'navy',
  onClick,
  icon,
  ariaLabel,
}: {
  label: string;
  description?: ReactNode;
  actionLabel?: ReactNode;
  tone?: WorkspaceCardTone;
  onClick?: () => void;
  icon?: ReactNode;
  ariaLabel?: string;
}) {
  const color = WORKSPACE_CARD_TONES[tone];
  const cardStyle = getWorkspaceCardStyle({ tone, interactive: Boolean(onClick) });
  const computedAriaLabel = ariaLabel ?? label;
  const content = (
    <>
      <div style={{ color: workspaceTheme.muted, fontSize: '11px', fontWeight: 600, lineHeight: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
        <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        {icon && <span aria-hidden="true" style={{ color, fontSize: '12px', flexShrink: 0 }}>{icon}</span>}
      </div>
      <div style={{ color: workspaceTheme.text, fontSize: '22px', fontWeight: 700, lineHeight: '26px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{actionLabel}</div>
      {description ? (
        <div style={{ fontSize: '11px', lineHeight: '14px', color: workspaceTheme.muted, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
          <span style={{ minWidth: 0 }}>{description}</span>
          <span aria-hidden="true" style={{ color, fontSize: '14px', fontWeight: 700, flexShrink: 0 }}>→</span>
        </div>
      ) : (
        <div style={{ fontSize: '11px', lineHeight: '14px', color: workspaceTheme.muted, display: 'flex', justifyContent: 'flex-end' }}>
          <span aria-hidden="true" style={{ color, fontSize: '14px', fontWeight: 700, flexShrink: 0 }}>→</span>
        </div>
      )}
    </>
  );
  if (!onClick) return <div role="group" aria-label={computedAriaLabel} style={cardStyle}>{content}</div>;
  return <button aria-label={computedAriaLabel} onClick={onClick} type="button" style={cardStyle}>{content}</button>;
}

export function Panel({ title, description, actions, children, style, flush = false }: { title?: string; description?: string; actions?: ReactNode; children: ReactNode; style?: CSSProperties; flush?: boolean }) {
  return (
    <section className="xdrive-panel" style={{ background: workspaceTheme.surface, border: `1px solid ${workspaceTheme.border}`, borderRadius: '4px', boxShadow: compactShadow, overflow: 'hidden', ...style }}>
      {(title || description || actions) && <div className="xdrive-panel__header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', minHeight: '36px', borderBottom: `1px solid ${workspaceTheme.border}`, flexWrap: 'wrap', background: workspaceTheme.surfaceMuted }}><div>{title && <h2 className="xdrive-panel__title" style={{ margin: 0, color: workspaceTheme.text, fontSize: '13px', fontWeight: 600, lineHeight: '18px' }}>{title}</h2>}{description && <p className="xdrive-panel__description" style={{ margin: '2px 0 0', color: workspaceTheme.muted, fontSize: '11px', lineHeight: '14px' }}>{description}</p>}</div>{actions && <div className="xdrive-panel__actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>{actions}</div>}</div>}
      <div className={`xdrive-panel__body${flush ? ' xdrive-panel__body--flush' : ''}`} style={{ padding: flush ? 0 : '10px' }}>{children}</div>
    </section>
  );
}

/**
 * OperationalPageLayout
 *
 * Top-level page frame derived from CX reference measurements:
 * - Viewport: 1920×1080
 * - App frame padding: 12px
 * - Max content width: 1480px
 * - Two-panel variant: shared 165px search aside + 1fr main content
 *
 * Use `searchPanel` to render the left OperationalFilters sidebar.
 * Omit `searchPanel` for full-width single-panel pages (e.g. Dashboard).
 */
export function OperationalPageLayout({
  children,
  searchPanel,
  maxWidth,
  style,
  className,
}: {
  children: ReactNode;
  /** Optional left search/filter panel. When provided, the layout switches to
   *  the shared 165px aside + flexible main two-column grid. */
  searchPanel?: ReactNode;
  maxWidth?: number;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={`xdrive-operational-page-layout ${styles.operationalPageLayout}${className ? ` ${className}` : ''}`}
      style={{ ...(typeof maxWidth === 'number' ? { ['--xdrive-page-max-width' as string]: `${maxWidth}px` } : {}), ...style } as CSSProperties}
    >
      {searchPanel ? (
        <div className={`xdrive-operational-page-layout__two-panel ${styles.operationalPageLayoutTwoPanel}`}>
          <aside
            className={`xdrive-operational-page-layout__search-aside ${styles.operationalPageLayoutSearchAside}`}
            aria-label="Search and filters"
          >
            {searchPanel}
          </aside>
          <main className={`xdrive-operational-page-layout__main ${styles.operationalPageLayoutMain}`}>{children}</main>
        </div>
      ) : (
        <main className={`xdrive-operational-page-layout__main ${styles.operationalPageLayoutMain}`}>{children}</main>
      )}
    </div>
  );
}

/**
 * OperationalCard
 *
 * Card primitive derived from CX reference card anatomy:
 * - Border: 1px solid #D8DEE8 (border-first, no shadow)
 * - Border-radius: 4px
 * - Header padding: 8px 12px — measured from CX diary and activity cards
 * - Body padding: 12px
 * - Footer padding: 8px 12px, background #F4F6F8
 * - Title: 14px / 600   Subtitle: 11px / 400
 *
 * Replaces ad-hoc `Panel` usage when strict CX density is required.
 */
export function OperationalCard({
  title,
  subtitle,
  actions,
  children,
  footer,
  flush = false,
  style,
  className,
  as: Tag = 'section',
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  flush?: boolean;
  style?: CSSProperties;
  className?: string;
  as?: 'section' | 'article' | 'div';
}) {
  return (
    <Tag className={`xdrive-operational-card ${styles.operationalCard}${className ? ` ${className}` : ''}`} style={style}>
      {(title || subtitle || actions) && (
        <div className={`xdrive-operational-card__header ${styles.operationalCardHeader}`}>
          <div className={styles.operationalCardHeaderText}>
            {title && <h3 className={styles.operationalCardTitle}>{title}</h3>}
            {subtitle && <p className={styles.operationalCardSubtitle}>{subtitle}</p>}
          </div>
          {actions && (
            <div className={styles.operationalCardHeaderActions}>{actions}</div>
          )}
        </div>
      )}
      <div className={`xdrive-operational-card__body${flush ? ' xdrive-operational-card__body--flush' : ''} ${flush ? styles.operationalCardBodyFlush : styles.operationalCardBody}`}>
        {children}
      </div>
      {footer && <div className={styles.operationalCardFooter}>{footer}</div>}
    </Tag>
  );
}

/**
 * OperationalFilterField
 *
 * Single labelled field row within an OperationalFilters panel.
 * Provides consistent label + control layout with optional clear button.
 *
 * Measurements from CX search panel:
 * - Label: 11px / 600 uppercase
 * - Input/select height: 32px (XDrive spec, CX ≈ 28–30px)
 * - Gap label→control: 2px
 * - Clearable inputs show an × button inline
 */
export function OperationalFilterField({
  label,
  htmlFor,
  children,
}: {
  label?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.operationalFilterField}>
      {label && (
        <label htmlFor={htmlFor} className={styles.operationalFilterLabel}>
          {label}
        </label>
      )}
      {children}
    </div>
  );
}

/**
 * OperationalFilterInput
 *
 * Controlled text input for use inside OperationalFilterField.
 * Optionally renders an inline × clear button (matches CX panel pattern).
 */
export function OperationalFilterInput({
  id,
  value,
  onChange,
  onClear,
  placeholder,
  type = 'text',
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  type?: 'text' | 'date' | 'number';
}) {
  return (