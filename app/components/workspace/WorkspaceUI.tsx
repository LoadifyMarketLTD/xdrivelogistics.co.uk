'use client';

import type { CSSProperties, ReactNode, FormEvent } from 'react';
import styles from './WorkspaceUI.module.css';

export const workspaceTheme = {
  page: '#f5f7fa',
  surface: '#ffffff',
  surfaceSoft: '#f5f7fa',
  surfaceMuted: '#f2f6fb',
  border: '#d9e2ec',
  borderStrong: '#c7d2df',
  text: '#202124',
  muted: '#5f6368',
  blue: '#1d57d8',
  navy: '#0b2f6b',
  orange: '#f5a300',
  green: '#35a853',
  red: '#d93025',
  amber: '#d97706',
  purple: '#7c3aed',
};

const compactShadow = 'none';

export function PageFrame({ children, maxWidth = 1480 }: { children: ReactNode; maxWidth?: number }) {
  return <div className="xdrive-page-frame" style={{ width: '100%', maxWidth, margin: '0 auto', padding: '12px' }}>{children}</div>;
}

export function PageHeader({ eyebrow, title, description, actions, meta }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; meta?: ReactNode }) {
  return (
    <header className="xdrive-page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
      <div style={{ minWidth: 0, flex: '1 1 520px' }}>
        {eyebrow && <div style={{ color: workspaceTheme.blue, fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>{eyebrow}</div>}
        <h1 style={{ margin: 0, color: workspaceTheme.text, fontSize: '28px', fontWeight: 600, lineHeight: 1.35 }}>{title}</h1>
        {description && <p style={{ margin: '8px 0 0', color: workspaceTheme.muted, maxWidth: '860px', fontSize: '13px', lineHeight: 1.35 }}>{description}</p>}
        {meta && <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' }}>{meta}</div>}
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>{actions}</div>}
    </header>
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
  return <button title={title} type={type} disabled={disabled} onClick={onClick} style={{ border: `1px solid ${palette.border}`, background: disabled ? '#e2e8f0' : palette.bg, color: disabled ? '#64748b' : palette.color, borderRadius: '4px', padding: '8px 14px', minHeight: '32px', fontSize: '13px', fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', boxShadow: tone === 'secondary' || tone === 'danger' ? 'none' : compactShadow, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>{children}</button>;
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
  tone?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'navy';
  onClick?: () => void;
  icon?: ReactNode;
  /** Optional trend / delta indicator shown below the value. */
  trend?: KpiTrend;
  /** Accessible label for the card. Defaults to the label text when omitted. */
  ariaLabel?: string;
}) {
  const color = { blue: workspaceTheme.blue, green: workspaceTheme.green, orange: workspaceTheme.orange, red: workspaceTheme.red, purple: workspaceTheme.purple, navy: workspaceTheme.navy }[tone];
  const cardStyle = { textAlign: 'left' as const, background: workspaceTheme.surface, border: `1px solid ${workspaceTheme.border}`, borderRadius: '4px', padding: '12px', minHeight: '88px', boxShadow: compactShadow, cursor: onClick ? 'pointer' : 'default', position: 'relative' as const, overflow: 'hidden' };
  const computedAriaLabel = ariaLabel ?? label;
  const content = (
    <>
      <span aria-hidden="true" style={{ position: 'absolute', inset: '0 auto 0 0', width: '3px', background: color }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
        <div style={{ color: workspaceTheme.muted, fontSize: '12px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</div>
        {icon && <div aria-hidden="true" style={{ color, fontSize: '13px' }}>{icon}</div>}
      </div>
      <div style={{ marginTop: '4px', color: workspaceTheme.text, fontSize: '20px', fontWeight: 600, lineHeight: 1.35 }}>{value}</div>
      {detail && <div style={{ color: workspaceTheme.muted, fontSize: '11px', marginTop: '8px', lineHeight: 1.35 }}>{detail}</div>}
      {trend && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.28rem', marginTop: '0.38rem' }}>
          <span aria-hidden="true" style={{ color: SENTIMENT_COLORS[trend.sentiment ?? 'neutral'], fontSize: '0.7rem', fontWeight: 900 }}>{TREND_ARROWS[trend.direction]}</span>
          <span style={{ color: SENTIMENT_COLORS[trend.sentiment ?? 'neutral'], fontSize: '0.68rem', fontWeight: 800 }}>{trend.delta}</span>
          {trend.label && <span style={{ color: workspaceTheme.muted, fontSize: '0.64rem' }}>{trend.label}</span>}
        </div>
      )}
    </>
  );
  if (!onClick) return <div role="group" aria-label={computedAriaLabel} style={cardStyle}>{content}</div>;
  return <button aria-label={computedAriaLabel} onClick={onClick} type="button" style={cardStyle}>{content}</button>;
}

export function Panel({ title, description, actions, children, style, flush = false }: { title?: string; description?: string; actions?: ReactNode; children: ReactNode; style?: CSSProperties; flush?: boolean }) {
  return (
    <section style={{ background: workspaceTheme.surface, border: `1px solid ${workspaceTheme.border}`, borderRadius: '9px', boxShadow: compactShadow, overflow: 'hidden', ...style }}>
      {(title || description || actions) && <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', padding: '0.78rem 0.9rem', borderBottom: `1px solid ${workspaceTheme.border}`, flexWrap: 'wrap' }}><div>{title && <h2 style={{ margin: 0, color: workspaceTheme.text, fontSize: '1rem' }}>{title}</h2>}{description && <p style={{ margin: '0.2rem 0 0', color: workspaceTheme.muted, fontSize: '0.78rem', lineHeight: 1.4 }}>{description}</p>}</div>{actions && <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>{actions}</div>}</div>}
      <div style={{ padding: flush ? 0 : '0.9rem' }}>{children}</div>
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
 * - Two-panel variant: 230px search aside + 1fr main content, 12px gap
 *
 * Use `searchPanel` to render the left OperationalFilters sidebar.
 * Omit `searchPanel` for full-width single-panel pages (e.g. Dashboard).
 */
export function OperationalPageLayout({
  children,
  searchPanel,
  maxWidth = 1480,
  style,
}: {
  children: ReactNode;
  /** Optional left search/filter panel. When provided, the layout switches to
   *  a 230px aside + flexible main two-column grid. */
  searchPanel?: ReactNode;
  maxWidth?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      className={styles.operationalPageLayout}
      style={{ ['--xdrive-page-max-width' as string]: `${maxWidth}px`, ...style } as CSSProperties}
    >
      {searchPanel ? (
        <div className={styles.operationalPageLayoutTwoPanel}>
          <aside
            className={styles.operationalPageLayoutSearchAside}
            aria-label="Search and filters"
          >
            {searchPanel}
          </aside>
          <main className={styles.operationalPageLayoutMain}>{children}</main>
        </div>
      ) : (
        <main className={styles.operationalPageLayoutMain}>{children}</main>
      )}
    </div>
  );
}

/**
 * OperationalCard
 *
 * Card primitive derived from CX reference card anatomy:
 * - Border: 1px solid #d9e2ec (border-first, no shadow)
 * - Border-radius: 4px
 * - Header padding: 8px 12px — measured from CX diary and activity cards
 * - Body padding: 12px
 * - Footer padding: 8px 12px, background #f5f7fa
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
  as: Tag = 'section',
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  flush?: boolean;
  style?: CSSProperties;
  as?: 'section' | 'article' | 'div';
}) {
  return (
    <Tag className={styles.operationalCard} style={style}>
      {(title || subtitle || actions) && (
        <div className={styles.operationalCardHeader}>
          <div className={styles.operationalCardHeaderText}>
            {title && <h3 className={styles.operationalCardTitle}>{title}</h3>}
            {subtitle && <p className={styles.operationalCardSubtitle}>{subtitle}</p>}
          </div>
          {actions && (
            <div className={styles.operationalCardHeaderActions}>{actions}</div>
          )}
        </div>
      )}
      <div className={flush ? styles.operationalCardBodyFlush : styles.operationalCardBody}>
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
    <div className={styles.operationalFilterInputRow}>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={styles.operationalFilterInput}
      />
      {onClear && value && (
        <button
          type="button"
          onClick={onClear}
          className={styles.operationalFilterClearBtn}
          aria-label="Clear field"
        >
          ×
        </button>
      )}
    </div>
  );
}

/**
 * OperationalFilterSelect
 *
 * Controlled select for use inside OperationalFilterField.
 */
export function OperationalFilterSelect({
  id,
  value,
  onChange,
  options,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={styles.operationalFilterSelect}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

/**
 * OperationalFilters
 *
 * Full search/filter panel derived from CX reference measurements:
 *
 * CX Search Panel anatomy (screenshots: Diary, Loads pages):
 * - Panel width:  230px (XDrive spec; CX ≈ 200px)
 * - Background:   #ffffff, border: 1px solid #d9e2ec
 * - Header:       8px 10px padding, uppercase 12px/600 title, #f5f7fa background
 * - Body:         8px 10px padding, 6px gap between fields
 * - Footer:       8px 10px padding, 4px gap between buttons
 * - Search btn:   32px height, full-width, #35a853 green
 * - Clear btn:    32px height, full-width, secondary (white + border)
 *
 * Compose fields using OperationalFilterField, OperationalFilterInput,
 * OperationalFilterSelect as children.
 */
export function OperationalFilters({
  title = 'Search Panel',
  children,
  onSearch,
  onClear,
  saveAsDefault,
  onSaveAsDefaultChange,
  footer,
}: {
  /** Panel heading. Defaults to "Search Panel". */
  title?: string;
  /** Filter fields — compose with OperationalFilterField. */
  children?: ReactNode;
  /** Called when the Search button is pressed. */
  onSearch?: (e: FormEvent<HTMLFormElement>) => void;
  /** Called when the Clear button is pressed. */
  onClear?: () => void;
  /** "Save as Default" checkbox state. */
  saveAsDefault?: boolean;
  onSaveAsDefaultChange?: (checked: boolean) => void;
  /** Optional custom footer content rendered below the buttons. */
  footer?: ReactNode;
}) {
  return (
    <aside className={styles.operationalFilters} aria-label={title}>
      <div className={styles.operationalFiltersHeader}>
        <h2 className={styles.operationalFiltersTitle}>{title}</h2>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSearch?.(e);
        }}
      >
        <div className={styles.operationalFiltersBody}>{children}</div>
        <div className={styles.operationalFiltersFooter}>
          {onSaveAsDefaultChange !== undefined && (
            <label className={styles.operationalFiltersSaveRow}>
              <input
                type="checkbox"
                checked={!!saveAsDefault}
                onChange={(e) => onSaveAsDefaultChange(e.target.checked)}
                className={styles.operationalFiltersSaveCheckbox}
              />
              Save as Default
            </label>
          )}
          {onSearch && (
            <button type="submit" className={styles.operationalFiltersSearchBtn}>
              Search
            </button>
          )}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className={styles.operationalFiltersClearBtn}
            >
              Clear
            </button>
          )}
          {footer}
        </div>
      </form>
    </aside>
  );
}

export function FinancialSummaryPanel({
  items,
}: {
  items: Array<{ label: string; value: ReactNode; color: string; background: string }>;
}) {
  return (
    <div className={styles.financialSummaryPanel}>
      {items.map((item) => (
        <div key={item.label} className={styles.financialSummaryRow} style={{ ['--xdrive-finance-row-bg' as const]: item.background, ['--xdrive-finance-row-color' as const]: item.color } as CSSProperties}>
          <span className={styles.financialSummaryLabel}>{item.label}</span>
          <strong className={styles.financialSummaryValue}>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function ComplianceSummaryPanel({
  rows,
  total,
}: {
  rows: Array<{ label: string; count: number; color: string; background: string; border: string }>;
  total: number;
}) {
  if (total <= 0) {
    return <div className={styles.complianceSummaryEmpty}>No compliance documents on record.</div>;
  }
  return (
    <div>
      <div className={styles.complianceSummaryRows}>
        {rows.map((row) => {
          const pct = Math.round((row.count / total) * 100);
          return (
            <div key={row.label} className={styles.complianceSummaryRow}>
              <div className={styles.complianceSummaryDot} style={{ ['--xdrive-dot-bg' as const]: row.background, ['--xdrive-dot-border' as const]: row.border } as CSSProperties} />
              <span className={styles.complianceSummaryLabel}>{row.label}</span>
              <strong className={styles.complianceSummaryCount} style={{ color: row.color }}>{row.count}</strong>
              <span className={styles.complianceSummaryPct}>{pct}%</span>
            </div>
          );
        })}
      </div>
      <div className={styles.complianceSummaryMeter}>
        {rows.filter((row) => row.count > 0).map((row) => (
          <div key={`bar-${row.label}`} style={{ width: `${(row.count / total) * 100}%`, background: row.color }} />
        ))}
      </div>
    </div>
  );
}

export function TwoColumn({ children, rightWidth = 'minmax(290px, 0.78fr)' }: { children: ReactNode; rightWidth?: string }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `minmax(0, 1.45fr) ${rightWidth}`, gap: '0.8rem', alignItems: 'start' }} className="xdrive-two-column">{children}</div>;
}

export function QuickActionGrid({
  actions,
}: {
  actions: Array<{ key: string; label: string; onClick: () => void; trailing?: ReactNode }>;
}) {
  return (
    <div className={styles.quickActionGrid}>
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          onClick={action.onClick}
          className={styles.quickActionButton}
        >
          <span>{action.label}</span>
          {action.trailing ?? <span aria-hidden="true">→</span>}
        </button>
      ))}
    </div>
  );
}

export function DateRangeSelector({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={styles.selectorControl}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function SavedViewSelector({
  value,
  onChange,
  options,
  label = 'Saved view',
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  label?: string;
}) {
  return (
    <label className={styles.savedViewSelector}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={styles.selectorControl}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function WorkspaceActivityFeed({
  items,
  error,
  classNames,
  labelColor,
  timeColor,
  background,
  onItemClick,
}: {
  items: Array<{ id: string; label: string; reference: string | null; created_at: string; href?: string | null }>;
  error: string;
  classNames: {
    root: string;
    title: string;
    track: string;
    item: string;
    time: string;
    error: string;
  };
  labelColor: string;
  timeColor: string;
  background: string;
  onItemClick?: (href: string, itemId: string) => void;
}) {
  if (items.length === 0 && !error) return null;
  return (
    <div className={`${styles.workspaceActivityFeed} ${classNames.root}`} style={{ ['--xdrive-feed-bg' as const]: background } as CSSProperties} aria-live="polite" aria-label="Activity feed">
      <div className={`${styles.workspaceActivityFeedTitle} ${classNames.title}`} style={{ color: labelColor }}>
        ● ACTIVITY
      </div>
      {items.length > 0 ? (
        <div className={`${styles.workspaceActivityFeedTrack} ${classNames.track}`}>
          {[...items, ...items].map((item, index) => {
            const time = new Date(item.created_at).toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'UTC',
            });
            const text = `${item.label}${item.reference ? ` – ${item.reference}` : ''}`;
            return (
              <span key={`${item.id}-${index}`} className={`${styles.workspaceActivityFeedItem} ${classNames.item}`}>
                <span className={`${styles.workspaceActivityFeedTime} ${classNames.time}`} style={{ color: timeColor }}>
                  {time}
                </span>
                {item.href ? (
                  <button
                    type="button"
                    className={styles.workspaceActivityFeedItemButton}
                    onClick={() => onItemClick?.(item.href as string, item.id)}
                    aria-label={`Open activity item ${text}`}
                  >
                    {text}
                  </button>
                ) : (
                  text
                )}
              </span>
            );
          })}
        </div>
      ) : (
        <div className={classNames.error}>{error}</div>
      )}
    </div>
  );
}

/** Explicit tone values for StatusBadge — keyed by semantic intent, never inferred from display text. */
export type StatusBadgeTone = 'green' | 'blue' | 'orange' | 'red' | 'grey' | 'purple';

type StatusBadgeColorPalette = { bg: string; color: string; border: string };

/** Deterministic colour palette lookup for StatusBadge — keyed by explicit tone. */
export const STATUS_BADGE_COLORS: Record<StatusBadgeTone, StatusBadgeColorPalette> = {
  green:  { bg: '#ecfdf3', color: '#166534', border: '#bbf7d0' },
  blue:   { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  orange: { bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
  red:    { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  grey:   { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' },
  purple: { bg: '#faf5ff', color: '#7e22ce', border: '#e9d5ff' },
};

export function StatusBadge({ value, tone, ariaLabel }: { value: string; tone?: StatusBadgeTone; ariaLabel?: string }) {
  const normalised = String(value || 'unknown').trim().toLowerCase();
  const resolvedTone: StatusBadgeTone = tone ?? (normalised.includes('delivered') || normalised.includes('completed') || normalised.includes('active') || normalised.includes('approved') || normalised === 'paid' || normalised === 'ready' ? 'green' : normalised.includes('late') || normalised.includes('overdue') || normalised.includes('failed') || normalised.includes('cancel') || normalised.includes('error') || normalised.includes('dispute') ? 'red' : normalised.includes('pending') || normalised.includes('waiting') || normalised.includes('quoted') ? 'orange' : normalised.includes('draft') ? 'grey' : 'blue');
  const colors = STATUS_BADGE_COLORS[resolvedTone];
  const label = normalised.replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
  return <span aria-label={ariaLabel} style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${colors.border}`, background: colors.bg, color: colors.color, borderRadius: '999px', padding: '0.18rem 0.45rem', fontSize: '0.7rem', fontWeight: 800, whiteSpace: 'nowrap' }}>{label}</span>;
}

/** Semantic tone values for SemanticStatusBadge — keyed by intent, never inferred from display text. */
export type SemanticStatusBadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

type SemanticStatusBadgeColorPalette = { bg: string; color: string; border: string };

/** Deterministic colour palette for SemanticStatusBadge — keyed by explicit semantic tone only. */
export const SEMANTIC_STATUS_BADGE_COLORS: Record<SemanticStatusBadgeTone, SemanticStatusBadgeColorPalette> = {
  neutral: { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' },
  info:    { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  success: { bg: '#ecfdf3', color: '#166534', border: '#bbf7d0' },
  warning: { bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
  danger:  { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
};

/**
 * Explicit-only status badge. Presentation is derived solely from `tone`; the
 * supplied `label` is rendered verbatim and never inspected for semantic meaning.
 * Omitting `tone` resolves to `neutral` — never to a colour inferred from text.
 */
export function SemanticStatusBadge({ label, tone = 'neutral', ariaLabel }: { label: string; tone?: SemanticStatusBadgeTone; ariaLabel?: string }) {
  const colors = SEMANTIC_STATUS_BADGE_COLORS[tone];
  return <span aria-label={ariaLabel} style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${colors.border}`, background: colors.bg, color: colors.color, borderRadius: '999px', padding: '0.18rem 0.45rem', fontSize: '0.7rem', fontWeight: 800, whiteSpace: 'nowrap' }}>{label}</span>;
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  const defaultIcon = <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#eff6ff', color: workspaceTheme.blue, display: 'grid', placeItems: 'center', margin: '0 auto 0.58rem', fontWeight: 900 }}>X</div>;
  return <div style={{ minHeight: '160px', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '1.7rem' }}><div>{icon ?? defaultIcon}<h3 style={{ margin: 0, color: workspaceTheme.text, fontSize: '0.95rem' }}>{title}</h3>{description && <p style={{ margin: '0.3rem auto 0', color: workspaceTheme.muted, fontSize: '0.78rem', maxWidth: '500px', lineHeight: 1.45 }}>{description}</p>}{action && <div style={{ marginTop: '0.72rem' }}>{action}</div>}</div></div>;
}

// ─── Standardized state primitives ──────────────────────────────────────────

/** Number of skeleton lines to show in `LoadingState` when no explicit count is supplied. */
export const LOADING_STATE_DEFAULT_ROWS = 3;

/**
 * Presentation-only loading state. Renders labelled skeleton bars and an
 * accessible `role="status"` region. No data fetching or side-effects.
 *
 * @param label  Screen-reader / visible label (e.g. "Loading shipments…"). Defaults to "Loading…".
 * @param rows   Number of skeleton content bars to render. Defaults to `LOADING_STATE_DEFAULT_ROWS`.
 */
export function LoadingState({ label = 'Loading\u2026', rows = LOADING_STATE_DEFAULT_ROWS }: { label?: string; rows?: number }) {
  const safeRows = Math.max(1, rows);
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className="xdrive-loading-state"
      style={{ minHeight: '160px', display: 'grid', placeItems: 'center', padding: '1.7rem' }}
    >
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.9rem', justifyContent: 'center' }}>
          <span
            aria-hidden="true"
            className="xdrive-loading-spinner"
            style={{
              display: 'inline-block',
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              border: `3px solid ${workspaceTheme.border}`,
              borderTopColor: workspaceTheme.blue,
              animation: 'xdrive-spin 0.8s linear infinite',
            }}
          />
          <span style={{ color: workspaceTheme.muted, fontSize: '0.78rem', fontWeight: 700 }}>{label}</span>
        </div>
        {Array.from({ length: safeRows }, (_, i) => (
          <div
            key={i}
            className="xdrive-skeleton-bar"
            aria-hidden="true"
            style={{
              height: '12px',
              borderRadius: '6px',
              background: workspaceTheme.surfaceMuted,
              marginBottom: '0.5rem',
              width: i % 2 === 0 ? '100%' : '72%',
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Presentation-only error state. Caller supplies the error message explicitly;
 * no business logic, retry mechanism, or auth session access.
 * Optional `onRetry` renders an accessible retry button supplied by the caller.
 * Optional `action` renders a caller-supplied ReactNode (e.g. a link) after the retry button.
 *
 * @param message  Required error description to display.
 * @param onRetry  Optional retry callback. When supplied, a retry button is rendered.
 * @param action   Optional caller-supplied ReactNode (e.g. "Go back" link). Rendered only when explicitly supplied.
 */
export function ErrorState({ message, onRetry, action, icon }: { message: string; onRetry?: () => void; action?: ReactNode; icon?: ReactNode }) {
  const defaultIcon = (
    <div
      aria-hidden="true"
      style={{
        width: '38px',
        height: '38px',
        borderRadius: '10px',
        background: '#fef2f2',
        color: workspaceTheme.red,
        display: 'grid',
        placeItems: 'center',
        margin: '0 auto 0.58rem',
        fontWeight: 900,
        fontSize: '1.1rem',
      }}
    >
      !
    </div>
  );
  return (
    <div
      role="alert"
      className="xdrive-error-state"
      style={{ minHeight: '160px', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '1.7rem' }}
    >
      <div>
        {icon ?? defaultIcon}
        <h3 style={{ margin: 0, color: workspaceTheme.text, fontSize: '0.9rem' }}>Something went wrong</h3>
        <p style={{ margin: '0.3rem auto 0', color: workspaceTheme.muted, fontSize: '0.74rem', maxWidth: '500px', lineHeight: 1.45 }}>{message}</p>
        {onRetry && (
          <div style={{ marginTop: '0.72rem' }}>
            <button
              type="button"
              onClick={onRetry}
              style={{
                border: `1px solid ${workspaceTheme.border}`,
                background: workspaceTheme.surface,
                color: workspaceTheme.blue,
                borderRadius: '8px',
                padding: '0.4rem 0.9rem',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}
        {action && <div style={{ marginTop: '0.72rem' }}>{action}</div>}
      </div>
    </div>
  );
}

/**
 * Presentation-only permission-denied state. Derives no permissions itself;
 * caller supplies `reason` text and an optional `action` element (e.g. a link
 * to request access). No auth session, role, company or Supabase access.
 *
 * @param reason  Optional explanation shown beneath the heading. Defaults to a generic message.
 * @param action  Optional ReactNode rendered as a CTA (e.g. "Request Access" link/button).
 */
export type PermissionDeniedStateProps = {
  reason?: string;
  action?: ReactNode;
  icon?: ReactNode;
};

export function PermissionDeniedState({ reason, action, icon }: PermissionDeniedStateProps) {
  const defaultIcon = (
    <div
      aria-hidden="true"
      style={{
        width: '38px',
        height: '38px',
        borderRadius: '10px',
        background: '#fffbeb',
        color: workspaceTheme.amber,
        display: 'grid',
        placeItems: 'center',
        margin: '0 auto 0.58rem',
        fontWeight: 900,
        fontSize: '1.1rem',
      }}
    >
      ⊘
    </div>
  );
  return (
    <div
      role="alert"
      className="xdrive-permission-denied-state"
      style={{ minHeight: '160px', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '1.7rem' }}
    >
      <div>
        {icon ?? defaultIcon}
        <h3 style={{ margin: 0, color: workspaceTheme.text, fontSize: '0.9rem' }}>Access restricted</h3>
        <p style={{ margin: '0.3rem auto 0', color: workspaceTheme.muted, fontSize: '0.74rem', maxWidth: '500px', lineHeight: 1.45 }}>
          {reason ?? 'You do not have permission to view this content.'}
        </p>
        {action && <div style={{ marginTop: '0.72rem' }}>{action}</div>}
      </div>
    </div>
  );
}

/**
 * Variant-controlled shared state primitive. `variant` alone selects ARIA semantics,
 * visual structure and interactivity. No auth, role, company, workspace or Supabase logic.
 *
 * - `'loading'`    → role="status"; non-interactive skeleton; never shows an action.
 * - `'empty'`      → caller-supplied title/description preserved verbatim; optional icon/action.
 * - `'error'`      → role="alert"; caller message preserved verbatim; optional icon/retry/action.
 * - `'permission'` → role="alert"; optional reason; optional icon/action; derives no permissions.
 *
 * Delegates to `LoadingState`, `EmptyState`, `ErrorState` or `PermissionDeniedState`; does
 * not duplicate their visual implementations and preserves all backward-compatible exports.
 */
export type WorkspaceStateProps =
  | { variant: 'loading'; label?: string; rows?: number }
  | { variant: 'empty'; title?: string; description?: string; icon?: ReactNode; action?: ReactNode }
  | { variant: 'error'; message: string; icon?: ReactNode; onRetry?: () => void; action?: ReactNode }
  | { variant: 'permission'; reason?: string; icon?: ReactNode; action?: ReactNode };

export function WorkspaceState(props: WorkspaceStateProps) {
  switch (props.variant) {
    case 'loading':
      return <LoadingState label={props.label} rows={props.rows} />;
    case 'empty':
      return <EmptyState title={props.title ?? 'No records found'} description={props.description} icon={props.icon} action={props.action} />;
    case 'error':
      return <ErrorState message={props.message} icon={props.icon} onRetry={props.onRetry} action={props.action} />;
    case 'permission':
      return <PermissionDeniedState reason={props.reason} icon={props.icon} action={props.action} />;
  }
}

export function DataTable({ columns, rows, empty }: { columns: string[]; rows: ReactNode[][]; empty?: ReactNode }) {
  return (
    <OperationalTable
      columns={columns.map((column, index) => ({
        id: `column-${index}`,
        header: column,
        cell: (row: ReactNode[]) => row[index] ?? '—',
        isAction: /action/i.test(column),
      }))}
      rows={rows}
      getRowKey={(row) => String(row[0] ?? row.map((cell) => String(cell)).join('|'))}
      empty={empty}
    />
  );
}

export function AlertBanner({ tone = 'warning', children }: { tone?: 'warning' | 'danger' | 'success' | 'info'; children: ReactNode }) {
  const alertStyles = { warning: { bg: '#fffbeb', border: '#fde68a', color: '#92400e' }, danger: { bg: '#fef2f2', border: '#fecaca', color: '#991b1b' }, success: { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534' }, info: { bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af' } }[tone];
  return <div style={{ background: alertStyles.bg, border: `1px solid ${alertStyles.border}`, color: alertStyles.color, borderRadius: '8px', padding: '0.65rem 0.78rem', fontSize: '0.76rem', fontWeight: 650, marginBottom: '0.75rem', lineHeight: 1.45 }}>{children}</div>;
}

export function QuickActions({ actions }: { actions: Array<{ label: string; description?: string; onClick: () => void; badge?: ReactNode }> }) {
  return <div style={{ display: 'grid', gap: '0.38rem' }}>{actions.map((action) => <button key={action.label} type="button" onClick={action.onClick} style={{ width: '100%', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: '0.55rem', border: `1px solid ${workspaceTheme.border}`, borderRadius: '8px', padding: '0.58rem 0.64rem', background: workspaceTheme.surfaceSoft, color: workspaceTheme.text, textAlign: 'left', cursor: 'pointer' }}><span><strong style={{ display: 'block', fontSize: '0.73rem' }}>{action.label}</strong>{action.description && <small style={{ color: workspaceTheme.muted, fontSize: '0.65rem' }}>{action.description}</small>}</span><span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>{action.badge}<span aria-hidden="true">→</span></span></button>)}</div>;
}

export function ProgressSteps({ steps, currentIndex }: { steps: string[]; currentIndex: number }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(steps.length, 1)}, minmax(72px,1fr))`, gap: '0.3rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>{steps.map((step, index) => { const complete = index < currentIndex; const current = index === currentIndex; return <div key={step} style={{ minWidth: '72px' }}><div style={{ height: '4px', borderRadius: '999px', background: complete || current ? workspaceTheme.blue : '#e2e8f0' }} /><div style={{ marginTop: '0.32rem', fontSize: '0.61rem', color: current ? workspaceTheme.blue : complete ? workspaceTheme.text : workspaceTheme.muted, fontWeight: current ? 850 : 650 }}>{step}</div></div>; })}</div>;
}

export function SettingsLayout({ navigation, activeId, onNavigate, children }: { navigation: Array<{ id: string; label: string; description?: string }>; activeId: string; onNavigate: (id: string) => void; children: ReactNode }) {
  return <div className="xdrive-settings-layout" style={{ display: 'grid', gridTemplateColumns: '230px minmax(0,1fr)', gap: '0.8rem', alignItems: 'start' }}><aside style={{ background: '#fff', border: `1px solid ${workspaceTheme.border}`, borderRadius: '9px', padding: '0.45rem', position: 'sticky', top: '72px' }}>{navigation.map((item) => { const active = item.id === activeId; return <button key={item.id} type="button" onClick={() => onNavigate(item.id)} style={{ width: '100%', border: 0, borderLeft: `3px solid ${active ? workspaceTheme.blue : 'transparent'}`, borderRadius: '7px', background: active ? '#eff6ff' : 'transparent', color: active ? workspaceTheme.blue : workspaceTheme.text, padding: '0.58rem 0.62rem', textAlign: 'left', cursor: 'pointer', marginBottom: '0.15rem' }}><strong style={{ display: 'block', fontSize: '0.72rem' }}>{item.label}</strong>{item.description && <small style={{ display: 'block', color: workspaceTheme.muted, marginTop: '0.1rem', fontSize: '0.62rem', lineHeight: 1.3 }}>{item.description}</small>}</button>; })}</aside><div style={{ minWidth: 0 }}>{children}</div></div>;
}

export function FormSection({ title, description, children, actions }: { title: string; description?: string; children: ReactNode; actions?: ReactNode }) {
  return <section style={{ background: '#fff', border: `1px solid ${workspaceTheme.border}`, borderRadius: '9px', marginBottom: '0.75rem', overflow: 'hidden' }}><div style={{ padding: '0.75rem 0.85rem', borderBottom: `1px solid ${workspaceTheme.border}`, display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}><div><h2 style={{ margin: 0, fontSize: '0.9rem', color: workspaceTheme.text }}>{title}</h2>{description && <p style={{ margin: '0.2rem 0 0', color: workspaceTheme.muted, fontSize: '0.7rem', lineHeight: 1.4 }}>{description}</p>}</div>{actions}</div><div style={{ padding: '0.85rem' }}>{children}</div></section>;
}

// ─── Action Centre primitives ────────────────────────────────────────────────
// Presentation-only; no role, company, workspace, route, permission or
// data-fetching logic. Callers supply all data; these components only render.

/** Priority levels for an Action Centre item. */
export type ActionCentreItemPriority = 'critical' | 'high' | 'medium' | 'low';

/** Status values for an Action Centre item. */
export type ActionCentreItemStatus = 'open' | 'in_progress' | 'resolved';

/** Optional call-to-action rendered only when explicitly supplied by the caller. Exactly one action must be provided. */
export type ActionCentreItemCta =
  /** Link variant — renders an anchor; `onClick` must be absent. */
  | { label: string; href: string; onClick?: never }
  /** Button variant — renders a button; `href` must be absent. */
  | { label: string; onClick: () => void; href?: never };

/** Data contract for a single Action Centre item. Contains only display fields. */
export type ActionCentreItem = {
  /** Stable, unique identifier for the item (used as React key). */
  id: string;
  /** Primary heading text. */
  title: string;
  /** Optional supporting description. */
  description?: string;
  /** Explicit priority — presentation colour is derived from this field, not from the title text. */
  priority: ActionCentreItemPriority;
  /** Explicit status — presentation colour is derived from this field, not from the title text. */
  status: ActionCentreItemStatus;
  /** Pre-formatted due label/date string, e.g. "Due 3 Aug" or "Overdue 2d". Never parsed by the component. */
  dueLabel?: string;
  /** Pre-formatted entity or reference label, e.g. "Job #JB-1042" or "Invoice INV-88". */
  entityLabel?: string;
  /** Pre-formatted assignee label, e.g. "J. Smith". */
  assigneeLabel?: string;
  /** Optional CTA rendered only when explicitly supplied. */
  cta?: ActionCentreItemCta;
};

type BadgePalette = { bg: string; color: string; border: string };

/** Colour lookup for priority badges — keyed by explicit priority, never inferred from text. */
export const ACTION_CENTRE_PRIORITY_COLORS: Record<ActionCentreItemPriority, BadgePalette> = {
  critical: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  high:     { bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
  medium:   { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  low:      { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' },
};

/** Colour lookup for status badges — keyed by explicit status, never inferred from text. */
export const ACTION_CENTRE_STATUS_COLORS: Record<ActionCentreItemStatus, BadgePalette> = {
  open:        { bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
  in_progress: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  resolved:    { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
};

/** Human-readable labels for priority and status fields. */
export const ACTION_CENTRE_PRIORITY_LABELS: Record<ActionCentreItemPriority, string> = {
  critical: 'Critical',
  high:     'High',
  medium:   'Medium',
  low:      'Low',
};

export const ACTION_CENTRE_STATUS_LABELS: Record<ActionCentreItemStatus, string> = {
  open:        'Open',
  in_progress: 'In Progress',
  resolved:    'Resolved',
};

/** Renders a single Action Centre item as a card. Presentation-only; no data fetching. */
export function ActionCentreItemCard({ item }: { item: ActionCentreItem }) {
  const priorityPalette = ACTION_CENTRE_PRIORITY_COLORS[item.priority];
  const statusPalette = ACTION_CENTRE_STATUS_COLORS[item.status];
  return (
    <article aria-label={item.title} className={styles.actionCentreItem}>
      <span
        aria-hidden="true"
        className={styles.actionCentreItemRail}
        style={{ ['--xdrive-action-rail' as const]: priorityPalette.color } as CSSProperties}
      />
      <div className={styles.actionCentreItemHeader}>
        <div className={styles.actionCentreItemContent}>
          <div className={styles.actionCentreItemTitle}>{item.title}</div>
          {item.description && <div className={styles.actionCentreItemDescription}>{item.description}</div>}
        </div>
        <div className={styles.actionCentreItemBadges}>
          <span
            className={styles.actionCentreBadge}
            style={{
              ['--xdrive-action-badge-bg' as const]: priorityPalette.bg,
              ['--xdrive-action-badge-color' as const]: priorityPalette.color,
              ['--xdrive-action-badge-border' as const]: priorityPalette.border,
            } as CSSProperties}
          >
            {ACTION_CENTRE_PRIORITY_LABELS[item.priority]}
          </span>
          <span
            className={styles.actionCentreBadge}
            style={{
              ['--xdrive-action-badge-bg' as const]: statusPalette.bg,
              ['--xdrive-action-badge-color' as const]: statusPalette.color,
              ['--xdrive-action-badge-border' as const]: statusPalette.border,
            } as CSSProperties}
          >
            {ACTION_CENTRE_STATUS_LABELS[item.status]}
          </span>
        </div>
      </div>
      {(item.dueLabel || item.entityLabel || item.assigneeLabel) && (
        <div className={styles.actionCentreMeta}>
          {item.entityLabel && <span className={styles.actionCentreMetaValue}>{item.entityLabel}</span>}
          {item.dueLabel && <span className={styles.actionCentreDue}>{item.dueLabel}</span>}
          {item.assigneeLabel && <span className={styles.actionCentreMetaValue}>→ {item.assigneeLabel}</span>}
        </div>
      )}
      {item.cta && (
        <div className={styles.actionCentreCta}>
          {item.cta.href ? (
            <a href={item.cta.href} className={styles.actionCentreLinkAnchor}>{item.cta.label} →</a>
          ) : (
            <button type="button" onClick={item.cta.onClick} className={styles.actionCentreLinkButton}>{item.cta.label} →</button>
          )}
        </div>
      )}
    </article>
  );
}

/** Renders a list of Action Centre items. Handles empty state. Presentation-only; no data fetching. */
export function ActionCentreList({ items, empty }: { items: ActionCentreItem[]; empty?: ReactNode }) {
  if (items.length === 0) return <>{empty ?? <EmptyState title="No action items" description="There are no outstanding action items at this time." />}</>;
  return (
    <div className={styles.actionCentreList}>
      {items.map((item) => <ActionCentreItemCard key={item.id} item={item} />)}
    </div>
  );
}

// ─── Operational Table primitives ────────────────────────────────────────────
// Presentation-only reusable typed table contract. Callers supply typed rows,
// column definitions, cell renderers and stable row keys. No role, company,
// permission, status-colour mapping, sorting, filtering or data-fetching logic.

/** Horizontal alignment for an OperationalTable column. */
export type OperationalTableAlign = 'left' | 'center' | 'right';

/** Definition for a single column in an OperationalTable. */
export type OperationalTableColumn<TRow> = {
  /** Stable unique id for the column (used as React key). */
  id: string;
  /** Header text rendered inside `<th scope="col">`. */
  header: string;
  /** Render function returning the cell content for a given row. Returns only caller-supplied content. */
  cell: (row: TRow) => ReactNode;
  /** Horizontal alignment of the column header and cells. Defaults to `'left'`. */
  align?: OperationalTableAlign;
  /** Optional CSS width hint applied to the column, e.g. `'120px'` or `'10%'`. */
  width?: string;
  /** Enables table-header sorting affordance for this column. */
  sortable?: boolean;
  /** Extracts a sortable value used when `sortable` is enabled. */
  sortValue?: (row: TRow) => string | number | null | undefined;
  /** Marks this as a canonical action column. */
  isAction?: boolean;
  /** Renders plain string content as canonical status badges. */
  semanticStatus?: boolean;
};

export type OperationalTableSort = {
  columnId: string;
  direction: 'asc' | 'desc';
};

/** Props for OperationalTable. */
export type OperationalTableProps<TRow> = {
  /** Column definitions in the order they should appear. */
  columns: OperationalTableColumn<TRow>[];
  /** Rows of caller-supplied authorised data to render. */
  rows: TRow[];
  /** Returns a stable unique key string for each row. Must not use the row index. */
  getRowKey: (row: TRow) => string;
  /** Optional accessible `<caption>` text for the table. */
  caption?: string;
  /** Custom empty-table content. Defaults to a standard empty-state message. */
  empty?: ReactNode;
  /** Loading state before rows are available. */
  loading?: boolean;
  /** Error text for failed data load. */
  error?: string | null;
  /** Retry handler for error state. */
  onRetry?: () => void;
  /** Optional search/filter/action slots rendered above the table. */
  searchSlot?: ReactNode;
  filterSlot?: ReactNode;
  actionsSlot?: ReactNode;
  /** Optional result count shown in the toolbar. */
  resultsCount?: number;
  /** Controlled sort state. */
  sort?: OperationalTableSort | null;
  /** Sort change callback. */
  onSortChange?: (next: OperationalTableSort | null) => void;
};

/** Reusable, accessible, presentation-only operational data table. */
export function OperationalTable<TRow>({
  columns,
  rows,
  getRowKey,
  caption,
  empty,
  loading,
  error,
  onRetry,
  searchSlot,
  filterSlot,
  actionsSlot,
  resultsCount,
  sort,
  onSortChange,
}: OperationalTableProps<TRow>) {
  if (loading) return <WorkspaceState variant="loading" label="Loading records…" rows={5} />;
  if (error) return <WorkspaceState variant="error" message={error} onRetry={onRetry} />;
  if (rows.length === 0) {
    return <>{empty ?? <EmptyState title="No records found" />}</>;
  }
  const activeSortColumn = sort ? columns.find((column) => column.id === sort.columnId) : null;
  const sortedRows =
    activeSortColumn?.sortable && activeSortColumn.sortValue && sort
      ? rows.slice().sort((left, right) => {
        const leftValue = activeSortColumn.sortValue?.(left);
        const rightValue = activeSortColumn.sortValue?.(right);
        if (leftValue === rightValue) return 0;
        const safeLeft = leftValue ?? '';
        const safeRight = rightValue ?? '';
        const result =
          typeof safeLeft === 'number' && typeof safeRight === 'number'
            ? safeLeft - safeRight
            : String(safeLeft).localeCompare(String(safeRight), 'en-GB', {
              numeric: true,
              sensitivity: 'base',
            });
        return sort.direction === 'asc' ? result : result * -1;
      })
      : rows;
  return (
    <section className={styles.operationalTableContainer}>
      {(searchSlot || filterSlot || actionsSlot || typeof resultsCount === 'number') && (
        <div className={styles.operationalTableToolbar}>
          <div className={styles.operationalTableFilters}>
            {searchSlot}
            {filterSlot}
          </div>
          <div className={styles.operationalTableMeta}>
            {typeof resultsCount === 'number' && <span>{resultsCount.toLocaleString('en-GB')} results</span>}
            {actionsSlot}
          </div>
        </div>
      )}
      <div className={styles.operationalTableScroll} style={{ overflowX: 'auto' }}>
        <table
          className={`${styles.operationalTable} ${styles.operationalTableMinWidth}`}
          style={{ ['--xdrive-operational-table-min-width' as const]: `${Math.max(columns.length * 138, 440)}px` } as CSSProperties}
        >
        {caption && (
          <caption className={styles.operationalTableCaption}>
            {caption}
          </caption>
        )}
        <thead>
          <tr className={styles.operationalTableHeaderRow}>
            {columns.map((col) => (
              <th
                key={col.id}
                scope="col"
                className={`${styles.operationalTableHeadCell} ${col.isAction ? styles.operationalTableActionHeadCell : ''}`}
                style={{ textAlign: col.align ?? 'left', ...(col.width ? { width: col.width } : {}) }}
              >
                {col.sortable ? (
                  <button
                    type="button"
                    className={styles.operationalTableSortButton}
                    onClick={() => {
                      if (!onSortChange) return;
                      if (!sort || sort.columnId !== col.id) {
                        onSortChange({ columnId: col.id, direction: 'asc' });
                        return;
                      }
                      if (sort.direction === 'asc') {
                        onSortChange({ columnId: col.id, direction: 'desc' });
                        return;
                      }
                      onSortChange(null);
                    }}
                    aria-label={`Sort by ${col.header}`}
                  >
                    {col.header}
                    <span aria-hidden="true" className={styles.operationalTableSortGlyph}>
                      {sort?.columnId === col.id ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </span>
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={getRowKey(row)} className={styles.operationalTableRow}>
              {columns.map((col) => (
                <td
                  key={col.id}
                  className={`${styles.operationalTableCell} ${col.isAction ? styles.operationalTableActionCell : ''}`}
                  style={{ textAlign: col.align ?? 'left' }}
                >
                  {(() => {
                    const content = col.cell(row);
                    if (!col.semanticStatus || typeof content !== 'string') return content;
                    return <StatusBadge value={content} />;
                  })()}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </section>
  );
}
