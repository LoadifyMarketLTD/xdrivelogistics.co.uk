'use client';

import type { CSSProperties, ReactNode } from 'react';

export const workspaceTheme = {
  page: '#eef2f6',
  surface: '#ffffff',
  surfaceSoft: '#f8fafc',
  border: '#d7e0ea',
  text: '#0f172a',
  muted: '#64748b',
  blue: '#1d4ed8',
  navy: '#0b2f6b',
  orange: '#f5a300',
  green: '#15803d',
  red: '#dc2626',
  amber: '#d97706',
  purple: '#7c3aed',
};

export function PageFrame({ children, maxWidth = 1480 }: { children: ReactNode; maxWidth?: number }) {
  return <div style={{ width: '100%', maxWidth, margin: '0 auto', padding: '1.25rem clamp(0.9rem, 2vw, 1.6rem) 2.5rem' }}>{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
      <div style={{ minWidth: 0 }}>
        {eyebrow && <div style={{ color: workspaceTheme.blue, fontSize: '0.7rem', fontWeight: 850, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.28rem' }}>{eyebrow}</div>}
        <h1 style={{ margin: 0, color: workspaceTheme.text, fontSize: 'clamp(1.45rem, 2.3vw, 2rem)', lineHeight: 1.15, letterSpacing: '-0.025em' }}>{title}</h1>
        {description && <p style={{ margin: '0.42rem 0 0', color: workspaceTheme.muted, maxWidth: '850px', fontSize: '0.9rem', lineHeight: 1.5 }}>{description}</p>}
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>{actions}</div>}
    </header>
  );
}

export function ActionButton({
  children,
  onClick,
  tone = 'primary',
  disabled = false,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'secondary';
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  const palette = {
    primary: { bg: workspaceTheme.blue, color: '#fff', border: workspaceTheme.blue },
    success: { bg: workspaceTheme.green, color: '#fff', border: workspaceTheme.green },
    warning: { bg: workspaceTheme.orange, color: '#111827', border: workspaceTheme.orange },
    danger: { bg: '#fef2f2', color: workspaceTheme.red, border: '#fecaca' },
    secondary: { bg: '#fff', color: workspaceTheme.text, border: workspaceTheme.border },
  }[tone];
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        border: `1px solid ${palette.border}`,
        background: disabled ? '#cbd5e1' : palette.bg,
        color: disabled ? '#64748b' : palette.color,
        borderRadius: '8px',
        padding: '0.58rem 0.88rem',
        fontSize: '0.78rem',
        fontWeight: 800,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: tone === 'secondary' ? 'none' : '0 3px 8px rgba(15,23,42,0.12)',
      }}
    >
      {children}
    </button>
  );
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>{children}</div>;
}

export function KpiCard({
  label,
  value,
  detail,
  tone = 'blue',
  onClick,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'navy';
  onClick?: () => void;
}) {
  const color = {
    blue: workspaceTheme.blue,
    green: workspaceTheme.green,
    orange: workspaceTheme.orange,
    red: workspaceTheme.red,
    purple: workspaceTheme.purple,
    navy: workspaceTheme.navy,
  }[tone];
  return (
    <button
      onClick={onClick}
      type="button"
      style={{
        textAlign: 'left',
        background: workspaceTheme.surface,
        border: `1px solid ${workspaceTheme.border}`,
        borderTop: `3px solid ${color}`,
        borderRadius: '10px',
        padding: '0.8rem 0.85rem',
        minHeight: '104px',
        boxShadow: '0 5px 14px rgba(15,23,42,0.06)',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ color: workspaceTheme.muted, fontSize: '0.68rem', fontWeight: 850, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ marginTop: '0.3rem', color, fontSize: '1.7rem', fontWeight: 900, lineHeight: 1.05 }}>{value}</div>
      {detail && <div style={{ color: workspaceTheme.muted, fontSize: '0.73rem', marginTop: '0.4rem', lineHeight: 1.35 }}>{detail}</div>}
    </button>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  style,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section style={{ background: workspaceTheme.surface, border: `1px solid ${workspaceTheme.border}`, borderRadius: '11px', boxShadow: '0 5px 14px rgba(15,23,42,0.05)', overflow: 'hidden', ...style }}>
      {(title || description || actions) && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.8rem', padding: '0.9rem 1rem', borderBottom: `1px solid ${workspaceTheme.border}`, flexWrap: 'wrap' }}>
          <div>
            {title && <h2 style={{ margin: 0, color: workspaceTheme.text, fontSize: '1rem' }}>{title}</h2>}
            {description && <p style={{ margin: '0.25rem 0 0', color: workspaceTheme.muted, fontSize: '0.76rem', lineHeight: 1.4 }}>{description}</p>}
          </div>
          {actions && <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>{actions}</div>}
        </div>
      )}
      <div style={{ padding: '1rem' }}>{children}</div>
    </section>
  );
}

export function TwoColumn({ children, rightWidth = 'minmax(300px, 0.85fr)' }: { children: ReactNode; rightWidth?: string }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `minmax(0, 1.4fr) ${rightWidth}`, gap: '0.9rem', alignItems: 'start' }} className="xdrive-two-column">{children}</div>;
}

export function StatusBadge({ value, tone }: { value: string; tone?: 'green' | 'blue' | 'orange' | 'red' | 'grey' | 'purple' }) {
  const resolvedTone = tone ?? (value.toLowerCase().includes('delivered') || value.toLowerCase().includes('active') || value.toLowerCase().includes('approved') ? 'green' : value.toLowerCase().includes('late') || value.toLowerCase().includes('overdue') || value.toLowerCase().includes('error') ? 'red' : value.toLowerCase().includes('pending') || value.toLowerCase().includes('waiting') ? 'orange' : 'blue');
  const colors = {
    green: { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' },
    blue: { bg: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe' },
    orange: { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
    red: { bg: '#fee2e2', color: '#b91c1c', border: '#fecaca' },
    grey: { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' },
    purple: { bg: '#f3e8ff', color: '#7e22ce', border: '#e9d5ff' },
  }[resolvedTone];
  return <span style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${colors.border}`, background: colors.bg, color: colors.color, borderRadius: '999px', padding: '0.2rem 0.48rem', fontSize: '0.68rem', fontWeight: 800, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{value.replace(/_/g, ' ')}</span>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div style={{ minHeight: '180px', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '2rem' }}>
      <div>
        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#eff6ff', color: workspaceTheme.blue, display: 'grid', placeItems: 'center', margin: '0 auto 0.65rem', fontWeight: 900 }}>X</div>
        <h3 style={{ margin: 0, color: workspaceTheme.text, fontSize: '0.95rem' }}>{title}</h3>
        {description && <p style={{ margin: '0.35rem auto 0', color: workspaceTheme.muted, fontSize: '0.78rem', maxWidth: '500px', lineHeight: 1.45 }}>{description}</p>}
        {action && <div style={{ marginTop: '0.8rem' }}>{action}</div>}
      </div>
    </div>
  );
}

export function DataTable({ columns, rows, empty }: { columns: string[]; rows: ReactNode[][]; empty?: ReactNode }) {
  if (rows.length === 0) return <>{empty ?? <EmptyState title="No records found" />}</>;
  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: `${Math.max(columns.length * 145, 680)}px` }}>
        <thead>
          <tr>{columns.map((column) => <th key={column} style={{ textAlign: 'left', padding: '0.65rem 0.7rem', color: '#475569', fontSize: '0.66rem', fontWeight: 850, letterSpacing: '0.04em', textTransform: 'uppercase', borderBottom: `1px solid ${workspaceTheme.border}`, background: workspaceTheme.surfaceSoft }}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => <td key={cellIndex} style={{ padding: '0.72rem 0.7rem', color: workspaceTheme.text, fontSize: '0.78rem', borderBottom: '1px solid #edf2f7', verticalAlign: 'top' }}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AlertBanner({ tone = 'warning', children }: { tone?: 'warning' | 'danger' | 'success' | 'info'; children: ReactNode }) {
  const styles = {
    warning: { bg: '#fffbeb', border: '#fde68a', color: '#92400e' },
    danger: { bg: '#fef2f2', border: '#fecaca', color: '#991b1b' },
    success: { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534' },
    info: { bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af' },
  }[tone];
  return <div style={{ background: styles.bg, border: `1px solid ${styles.border}`, color: styles.color, borderRadius: '9px', padding: '0.72rem 0.85rem', fontSize: '0.8rem', fontWeight: 650, marginBottom: '0.85rem' }}>{children}</div>;
}
