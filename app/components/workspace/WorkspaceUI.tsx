'use client';

import type { CSSProperties, ReactNode } from 'react';

export const workspaceTheme = {
  page: '#f4f6f8',
  surface: '#ffffff',
  surfaceSoft: '#f8fafc',
  surfaceMuted: '#eef2f6',
  border: '#d7e0ea',
  borderStrong: '#c7d2df',
  text: '#0f172a',
  muted: '#64748b',
  blue: '#1d57d8',
  navy: '#0b2f6b',
  orange: '#f5a300',
  green: '#15803d',
  red: '#dc2626',
  amber: '#d97706',
  purple: '#7c3aed',
};

const compactShadow = '0 2px 8px rgba(15,23,42,0.05)';

export function PageFrame({ children, maxWidth = 1480 }: { children: ReactNode; maxWidth?: number }) {
  return <div className="xdrive-page-frame" style={{ width: '100%', maxWidth, margin: '0 auto', padding: '1.15rem clamp(0.85rem, 2vw, 1.5rem) 2.5rem' }}>{children}</div>;
}

export function PageHeader({ eyebrow, title, description, actions, meta }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; meta?: ReactNode }) {
  return (
    <header className="xdrive-page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
      <div style={{ minWidth: 0, flex: '1 1 520px' }}>
        {eyebrow && <div style={{ color: workspaceTheme.blue, fontSize: '0.67rem', fontWeight: 850, letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: '0.24rem' }}>{eyebrow}</div>}
        <h1 style={{ margin: 0, color: workspaceTheme.text, fontSize: 'clamp(1.35rem, 2vw, 1.85rem)', lineHeight: 1.15, letterSpacing: '-0.025em' }}>{title}</h1>
        {description && <p style={{ margin: '0.35rem 0 0', color: workspaceTheme.muted, maxWidth: '860px', fontSize: '0.84rem', lineHeight: 1.5 }}>{description}</p>}
        {meta && <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.55rem' }}>{meta}</div>}
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>{actions}</div>}
    </header>
  );
}

export function ActionButton({ children, onClick, tone = 'primary', disabled = false, type = 'button', title }: { children: ReactNode; onClick?: () => void; tone?: 'primary' | 'success' | 'warning' | 'danger' | 'secondary'; disabled?: boolean; type?: 'button' | 'submit'; title?: string }) {
  const palette = {
    primary: { bg: workspaceTheme.blue, color: '#fff', border: workspaceTheme.blue },
    success: { bg: workspaceTheme.green, color: '#fff', border: workspaceTheme.green },
    warning: { bg: workspaceTheme.orange, color: '#172033', border: workspaceTheme.orange },
    danger: { bg: '#fff', color: workspaceTheme.red, border: '#fecaca' },
    secondary: { bg: '#fff', color: workspaceTheme.text, border: workspaceTheme.borderStrong },
  }[tone];
  return <button title={title} type={type} disabled={disabled} onClick={onClick} style={{ border: `1px solid ${palette.border}`, background: disabled ? '#e2e8f0' : palette.bg, color: disabled ? '#64748b' : palette.color, borderRadius: '8px', padding: '0.54rem 0.82rem', minHeight: '36px', fontSize: '0.75rem', fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', boxShadow: tone === 'secondary' || tone === 'danger' ? 'none' : compactShadow, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>{children}</button>;
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="xdrive-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: '0.65rem', marginBottom: '0.9rem' }}>{children}</div>;
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
  const cardStyle = { textAlign: 'left' as const, background: workspaceTheme.surface, border: `1px solid ${workspaceTheme.border}`, borderRadius: '9px', padding: '0.72rem 0.78rem', minHeight: '98px', boxShadow: compactShadow, cursor: onClick ? 'pointer' : 'default', position: 'relative' as const, overflow: 'hidden' };
  const computedAriaLabel = ariaLabel ?? label;
  const content = (
    <>
      <span aria-hidden="true" style={{ position: 'absolute', inset: '0 auto 0 0', width: '3px', background: color }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'flex-start' }}>
        <div style={{ color: workspaceTheme.muted, fontSize: '0.64rem', fontWeight: 850, letterSpacing: '0.055em', textTransform: 'uppercase' }}>{label}</div>
        {icon && <div aria-hidden="true" style={{ color, fontSize: '0.9rem' }}>{icon}</div>}
      </div>
      <div style={{ marginTop: '0.26rem', color: workspaceTheme.text, fontSize: '1.55rem', fontWeight: 900, lineHeight: 1.05 }}>{value}</div>
      {detail && <div style={{ color: workspaceTheme.muted, fontSize: '0.69rem', marginTop: '0.35rem', lineHeight: 1.35 }}>{detail}</div>}
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
      {(title || description || actions) && <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', padding: '0.78rem 0.9rem', borderBottom: `1px solid ${workspaceTheme.border}`, flexWrap: 'wrap' }}><div>{title && <h2 style={{ margin: 0, color: workspaceTheme.text, fontSize: '0.94rem' }}>{title}</h2>}{description && <p style={{ margin: '0.2rem 0 0', color: workspaceTheme.muted, fontSize: '0.72rem', lineHeight: 1.4 }}>{description}</p>}</div>{actions && <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>{actions}</div>}</div>}
      <div style={{ padding: flush ? 0 : '0.9rem' }}>{children}</div>
    </section>
  );
}

export function TwoColumn({ children, rightWidth = 'minmax(290px, 0.78fr)' }: { children: ReactNode; rightWidth?: string }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `minmax(0, 1.45fr) ${rightWidth}`, gap: '0.8rem', alignItems: 'start' }} className="xdrive-two-column">{children}</div>;
}

export function StatusBadge({ value, tone }: { value: string; tone?: 'green' | 'blue' | 'orange' | 'red' | 'grey' | 'purple' }) {
  const normalised = String(value || 'unknown').trim().toLowerCase();
  const resolvedTone = tone ?? (normalised.includes('delivered') || normalised.includes('completed') || normalised.includes('active') || normalised.includes('approved') || normalised === 'paid' || normalised === 'ready' ? 'green' : normalised.includes('late') || normalised.includes('overdue') || normalised.includes('failed') || normalised.includes('cancel') || normalised.includes('error') || normalised.includes('dispute') ? 'red' : normalised.includes('pending') || normalised.includes('waiting') || normalised.includes('quoted') ? 'orange' : normalised.includes('draft') ? 'grey' : 'blue');
  const colors = { green: { bg: '#ecfdf3', color: '#166534', border: '#bbf7d0' }, blue: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' }, orange: { bg: '#fffbeb', color: '#92400e', border: '#fde68a' }, red: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' }, grey: { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' }, purple: { bg: '#faf5ff', color: '#7e22ce', border: '#e9d5ff' } }[resolvedTone];
  const label = normalised.replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
  return <span style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${colors.border}`, background: colors.bg, color: colors.color, borderRadius: '999px', padding: '0.18rem 0.45rem', fontSize: '0.64rem', fontWeight: 800, whiteSpace: 'nowrap' }}>{label}</span>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div style={{ minHeight: '160px', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '1.7rem' }}><div><div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#eff6ff', color: workspaceTheme.blue, display: 'grid', placeItems: 'center', margin: '0 auto 0.58rem', fontWeight: 900 }}>X</div><h3 style={{ margin: 0, color: workspaceTheme.text, fontSize: '0.9rem' }}>{title}</h3>{description && <p style={{ margin: '0.3rem auto 0', color: workspaceTheme.muted, fontSize: '0.74rem', maxWidth: '500px', lineHeight: 1.45 }}>{description}</p>}{action && <div style={{ marginTop: '0.72rem' }}>{action}</div>}</div></div>;
}

export function DataTable({ columns, rows, empty }: { columns: string[]; rows: ReactNode[][]; empty?: ReactNode }) {
  if (rows.length === 0) return <>{empty ?? <EmptyState title="No records found" />}</>;
  return <div style={{ width: '100%', overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: `${Math.max(columns.length * 138, 660)}px` }}><thead><tr>{columns.map((column) => <th key={column} style={{ textAlign: 'left', padding: '0.58rem 0.65rem', color: '#475569', fontSize: '0.62rem', fontWeight: 850, letterSpacing: '0.045em', textTransform: 'uppercase', borderBottom: `1px solid ${workspaceTheme.border}`, background: workspaceTheme.surfaceSoft, position: 'sticky', top: 0 }}>{column}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="xdrive-table-row">{row.map((cell, cellIndex) => <td key={cellIndex} style={{ padding: '0.65rem', color: workspaceTheme.text, fontSize: '0.74rem', borderBottom: '1px solid #edf2f7', verticalAlign: 'middle' }}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

export function AlertBanner({ tone = 'warning', children }: { tone?: 'warning' | 'danger' | 'success' | 'info'; children: ReactNode }) {
  const styles = { warning: { bg: '#fffbeb', border: '#fde68a', color: '#92400e' }, danger: { bg: '#fef2f2', border: '#fecaca', color: '#991b1b' }, success: { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534' }, info: { bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af' } }[tone];
  return <div style={{ background: styles.bg, border: `1px solid ${styles.border}`, color: styles.color, borderRadius: '8px', padding: '0.65rem 0.78rem', fontSize: '0.76rem', fontWeight: 650, marginBottom: '0.75rem', lineHeight: 1.45 }}>{children}</div>;
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

/** Optional call-to-action rendered only when explicitly supplied by the caller. */
export type ActionCentreItemCta = {
  /** Button/link label text. */
  label: string;
  /** Navigate to this URL when supplied (renders an anchor). Mutually exclusive with onClick. */
  href?: string;
  /** Inline handler when supplied (renders a button). Used when href is not provided. */
  onClick?: () => void;
};

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
  const badgeBase: CSSProperties = { display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '0.16rem 0.42rem', fontSize: '0.62rem', fontWeight: 800, whiteSpace: 'nowrap', border: '1px solid' };
  return (
    <article
      aria-label={item.title}
      style={{ background: workspaceTheme.surface, border: `1px solid ${workspaceTheme.border}`, borderRadius: '9px', padding: '0.78rem 0.85rem', boxShadow: compactShadow, position: 'relative', overflow: 'hidden' }}
    >
      <span aria-hidden="true" style={{ position: 'absolute', inset: '0 auto 0 0', width: '3px', background: priorityPalette.color }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 0' }}>
          <div style={{ color: workspaceTheme.text, fontSize: '0.8rem', fontWeight: 750, lineHeight: 1.35 }}>{item.title}</div>
          {item.description && <div style={{ color: workspaceTheme.muted, fontSize: '0.7rem', marginTop: '0.22rem', lineHeight: 1.4 }}>{item.description}</div>}
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
          <span style={{ ...badgeBase, background: priorityPalette.bg, color: priorityPalette.color, borderColor: priorityPalette.border }}>{ACTION_CENTRE_PRIORITY_LABELS[item.priority]}</span>
          <span style={{ ...badgeBase, background: statusPalette.bg, color: statusPalette.color, borderColor: statusPalette.border }}>{ACTION_CENTRE_STATUS_LABELS[item.status]}</span>
        </div>
      </div>
      {(item.dueLabel || item.entityLabel || item.assigneeLabel) && (
        <div style={{ display: 'flex', gap: '0.55rem', marginTop: '0.45rem', flexWrap: 'wrap' }}>
          {item.entityLabel && <span style={{ color: workspaceTheme.muted, fontSize: '0.65rem' }}>{item.entityLabel}</span>}
          {item.dueLabel && <span style={{ color: workspaceTheme.amber, fontSize: '0.65rem', fontWeight: 700 }}>{item.dueLabel}</span>}
          {item.assigneeLabel && <span style={{ color: workspaceTheme.muted, fontSize: '0.65rem' }}>→ {item.assigneeLabel}</span>}
        </div>
      )}
      {item.cta && (
        <div style={{ marginTop: '0.55rem' }}>
          {item.cta.href ? (
            <a href={item.cta.href} style={{ color: workspaceTheme.blue, fontSize: '0.7rem', fontWeight: 800, textDecoration: 'none' }}>{item.cta.label} →</a>
          ) : (
            <button type="button" onClick={item.cta.onClick} style={{ background: 'none', border: 'none', padding: 0, color: workspaceTheme.blue, fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}>{item.cta.label} →</button>
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
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      {items.map((item) => <ActionCentreItemCard key={item.id} item={item} />)}
    </div>
  );
}
