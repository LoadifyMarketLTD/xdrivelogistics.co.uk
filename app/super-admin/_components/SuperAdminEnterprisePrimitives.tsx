import type { ReactNode } from 'react';
import styles from './SuperAdminEnterprisePrimitives.module.css';

export type EnterpriseTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'unavailable';

const toneClass: Record<EnterpriseTone, string> = {
  neutral: styles.toneNeutral,
  info: styles.toneInfo,
  success: styles.toneSuccess,
  warning: styles.toneWarning,
  danger: styles.toneDanger,
  unavailable: styles.toneUnavailable,
};

export function SuperAdminPage({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${styles.page} ${className}`.trim()}>{children}</div>;
}

export function SuperAdminPageHeader({
  eyebrow,
  title,
  description,
  meta,
  icon,
  actions,
}: {  eyebrow: string;
  title: string;
  description: string;
  meta?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageHeaderLead}>
        {icon ? <span className={styles.pageHeaderIcon}>{icon}</span> : null}
        <div className={styles.pageHeaderCopy}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
          {meta ? <div className={styles.pageHeaderMeta}>{meta}</div> : null}
        </div>
      </div>
      {actions ? <div className={styles.pageHeaderActions}>{actions}</div> : null}
    </header>
  );
}

export function SuperAdminMetricGrid({ children }: { children: ReactNode }) {
  return <section className={styles.metricGrid}>{children}</section>;
}

export function SuperAdminMetricCard({
  label,
  value,
  note,
  tone = 'info',
}: {  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: EnterpriseTone;
}) {
  return (
    <article className={`${styles.metricCard} ${toneClass[tone]}`} data-card="enterprise-metric">
      <div className={styles.metricValue}>{value}</div>
      <div className={styles.metricLabel}>{label}</div>
      {note ? <div className={styles.metricNote}>{note}</div> : null}
    </article>
  );
}

export function SuperAdminSectionCard({
  title,
  description,
  actions,
  children,
  flush = false,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <section className={`${styles.sectionCard} ${flush ? styles.sectionCardFlush : ''}`} data-panel="enterprise">
      {title || description || actions ? (
        <div className={styles.sectionCardHeader}>
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className={styles.sectionCardActions}>{actions}</div> : null}
        </div>
      ) : null}      <div className={flush ? styles.sectionCardBodyFlush : styles.sectionCardBody}>{children}</div>
    </section>
  );
}

export function SuperAdminStatusBadge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: EnterpriseTone;
}) {
  return (
    <span className={`${styles.statusBadge} ${toneClass[tone]}`} data-status-chip="true">
      {label}
    </span>
  );
}

export function SuperAdminFilterBar({ children }: { children: ReactNode }) {
  return <div className={styles.filterBar}>{children}</div>;
}

export function SuperAdminNotice({ children, tone = 'info' }: { children: ReactNode; tone?: EnterpriseTone }) {
  return (
    <div className={`${styles.notice} ${toneClass[tone]}`} role={tone === 'danger' ? 'alert' : undefined}>
      {children}
    </div>
  );
}

export function SuperAdminEmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className={styles.statePanel} data-state="empty">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
export function SuperAdminUnavailableState({ title, description }: { title: string; description?: string }) {
  return (
    <div className={`${styles.statePanel} ${styles.stateUnavailable}`} data-state="unavailable" role="alert">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export type SuperAdminDataColumn<T> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
};

export function SuperAdminDataGrid<T>({
  columns,
  rows,
  rowKey,
  minWidth = 880,
}: {
  columns: SuperAdminDataColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  minWidth?: number;
}) {
  return (
    <div className={styles.dataGridScroll}>
      <table className={styles.dataGrid} style={{ minWidth }}>
        <thead><tr>{columns.map((column) => (
          <th key={column.key} style={{ textAlign: column.align ?? 'left' }}>{column.label}</th>
        ))}</tr></thead>        <tbody>{rows.map((row, index) => (
          <tr key={rowKey(row, index)}>
            {columns.map((column) => (
              <td key={column.key} style={{ textAlign: column.align ?? 'left' }}>{column.render(row)}</td>
            ))}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function SuperAdminPager({
  page,
  totalCount,
  canPrev,
  canNext,
  onPrev,
  onNext,
}: {
  page: number;
  totalCount: number | null;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className={styles.pager}>
      <span>Page {page}{totalCount !== null ? ` · ${totalCount.toLocaleString()} total` : ''}</span>
      <div className={styles.pagerActions}>
        <button data-pager-button="true" type="button" disabled={!canPrev} onClick={onPrev}>← Prev</button>
        <button data-pager-button="true" type="button" disabled={!canNext} onClick={onNext}>Next →</button>
      </div>
    </div>
  );
}
