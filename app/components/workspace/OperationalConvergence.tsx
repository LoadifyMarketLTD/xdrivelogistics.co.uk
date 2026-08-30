'use client';

import type { CSSProperties, ReactNode } from 'react';
import styles from './OperationalConvergence.module.css';
import type { WorkspaceCardTone } from './WorkspaceUI';

export type OperationalSignalItem = {
  key: string;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: WorkspaceCardTone;
  onClick?: () => void;
  ariaLabel?: string;
};

const toneClass: Record<WorkspaceCardTone, string> = {
  blue: styles.toneBlue,
  green: styles.toneGreen,
  orange: styles.toneOrange,
  red: styles.toneRed,
  purple: styles.tonePurple,
  navy: styles.toneNavy,
};

export function OperationalSignalStrip({
  items,
  ariaLabel = 'Operational signals',
}: {
  items: OperationalSignalItem[];
  ariaLabel?: string;
}) {
  const desktopColumns = Math.max(1, Math.min(items.length, 10));
  const signalStyle = { '--signal-columns': desktopColumns } as CSSProperties;

  return (
    <section className={styles.signalStrip} aria-label={ariaLabel} style={signalStyle} data-signal-count={items.length}>
      {items.map((item) => {
        const content = (
          <>
            <span className={styles.signalLabel}>{item.label}</span>
            <strong className={styles.signalValue}>{item.value}</strong>
            {item.detail ? <span className={styles.signalDetail}>{item.detail}</span> : null}
          </>
        );
        const className = `${styles.signalCell} ${toneClass[item.tone ?? 'blue']}`;
        return item.onClick ? (
          <button
            key={item.key}
            type="button"
            onClick={item.onClick}
            className={`${className} ${styles.signalButton}`}
            aria-label={item.ariaLabel ?? item.label}
          >
            {content}
          </button>
        ) : (
          <div key={item.key} className={className} role="group" aria-label={item.ariaLabel ?? item.label}>
            {content}
          </div>
        );
      })}
    </section>
  );
}

export function OperationalWorkspaceGrid({
  main,
  aside,
  asideLabel = 'Operational attention',
}: {
  main: ReactNode;
  aside: ReactNode;
  asideLabel?: string;
}) {
  return (
    <div className={styles.workspaceGrid}>
      <div className={styles.workspaceMain}>{main}</div>
      <aside className={styles.workspaceAside} aria-label={asideLabel}>{aside}</aside>
    </div>
  );
}

export function OperationalControlGrid({
  control,
  main,
  controlLabel = 'Operational controls',
}: {
  control: ReactNode;
  main: ReactNode;
  controlLabel?: string;
}) {
  return (
    <div className={styles.controlGrid}>
      <aside className={styles.controlAside} aria-label={controlLabel}>{control}</aside>
      <main className={styles.controlMain}>{main}</main>
    </div>
  );
}

export function OperationalAttentionRail({
  title,
  subtitle,
  meta,
  controls,
  children,
}: {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.attentionRail}>
      <header className={styles.attentionHeader}>
        <div className={styles.attentionTitleWrap}>
          <h3 className={styles.attentionTitle}>{title}</h3>
          {subtitle ? <p className={styles.attentionSubtitle}>{subtitle}</p> : null}
        </div>
        {meta ? <div className={styles.attentionMeta}>{meta}</div> : null}
      </header>
      {controls ? <div className={styles.attentionControls}>{controls}</div> : null}
      <div className={styles.attentionBody}>{children}</div>
    </section>
  );
}

export function OperationalAttentionItem({
  priority,
  entity,
  detail,
  state,
  tone = 'blue',
  action,
}: {
  priority: ReactNode;
  entity: ReactNode;
  detail?: ReactNode;
  state: ReactNode;
  tone?: WorkspaceCardTone;
  action?: ReactNode;
}) {
  return (
    <div className={`${styles.attentionItem} ${toneClass[tone]}`}>
      <div className={styles.attentionPriority}>{priority}</div>
      <div className={styles.attentionCopy}>
        <strong className={styles.attentionEntity}>{entity}</strong>
        {detail ? <span className={styles.attentionDetail}>{detail}</span> : null}
      </div>
      <div className={styles.attentionState}>{state}</div>
      {action ? <div className={styles.attentionAction}>{action}</div> : null}
    </div>
  );
}

export function OperationalRecord({
  primary,
  secondary,
  status,
  detail,
  actions,
  tone = 'blue',
  expanded = false,
}: {
  primary: ReactNode;
  secondary: ReactNode;
  status: ReactNode;
  detail?: ReactNode;
  actions?: ReactNode;
  tone?: WorkspaceCardTone;
  expanded?: boolean;
}) {
  return (
    <article className={`${styles.record} ${toneClass[tone]}`} data-expanded={expanded ? 'true' : 'false'}>
      <div className={styles.recordPrimaryGrid}>
        <div className={styles.recordCell}>{primary}</div>
        <div className={styles.recordCell}>{secondary}</div>
        <div className={`${styles.recordCell} ${styles.recordStatus}`}>{status}</div>
      </div>
      {detail ? <div className={styles.recordDetail}>{detail}</div> : null}
      {actions ? <OperationalActionRail>{actions}</OperationalActionRail> : null}
    </article>
  );
}

export function OperationalActionRail({ children }: { children: ReactNode }) {
  return <div className={styles.actionRail}>{children}</div>;
}
