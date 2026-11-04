'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import styles from './InvoiceProFinance.module.css';

/**
 * Single approved Invoice Pro visual frame.
 * Source of truth: /driver/finance on local port 3193.
 * The data adapters, financial permissions and write APIs remain role-specific.
 */
export function InvoiceProSurface(props: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={styles.surface} data-invoice-model="driver-3193" />;
}
export function InvoiceProNavigation(props: HTMLAttributes<HTMLElement>) {
  return <nav {...props} className={styles.nav} />;
}
export type InvoiceProTab = { id: string; label: string; active: boolean; onSelect: () => void; disabled?: boolean };
export function InvoiceProMasterTabs({ tabs, label = 'Finance navigation' }: { tabs: InvoiceProTab[]; label?: string }) {
  return <InvoiceProNavigation aria-label={label}>
    {tabs.map((tab) => <button key={tab.id} type="button" className={styles.navButton} data-active={tab.active} aria-current={tab.active ? 'page' : undefined} disabled={tab.disabled} onClick={tab.onSelect}>{tab.label}</button>)}
  </InvoiceProNavigation>;
}
export function InvoiceProStatusTabs({ tabs, label = 'Invoice states' }: { tabs: InvoiceProTab[]; label?: string }) {
  return <div className={styles.tabStrip} role="tablist" aria-label={label}>
    {tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={tab.active} className={styles.tabButton} data-active={tab.active} disabled={tab.disabled} onClick={tab.onSelect}>{tab.label}</button>)}
  </div>;
}
export function InvoiceProHero(props: HTMLAttributes<HTMLElement>) {
  return <header {...props} className={styles.hero} />;
}
export function InvoiceProMetrics(props: HTMLAttributes<HTMLElement>) {
  return <section {...props} className={styles.metrics} />;
}
export function InvoiceProDashboard(props: HTMLAttributes<HTMLElement>) {
  return <section {...props} className={styles.dashboard} />;
}
export function InvoiceProRegister(props: HTMLAttributes<HTMLElement>) {
  return <section {...props} className={styles.register} />;
}
export function InvoiceProPanel({ children, ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return <section {...props} className={styles.panel}>{children}</section>;
}
