'use client';

import type { ReactNode } from 'react';
import { workspaceTheme } from './WorkspaceUI';

export type AccountSectionNavItem = {
  id: string;
  label: string;
  detail?: string;
  active?: boolean;
  onClick: () => void;
};

export function AccountSectionNav({
  title = 'Account',
  items,
  footer,
}: {
  title?: string;
  items: AccountSectionNavItem[];
  footer?: ReactNode;
}) {
  return (
    <aside
      aria-label={`${title} sections`}
      style={{
        width: '100%',
        border: `1px solid ${workspaceTheme.border}`,
        borderRadius: 4,
        background: workspaceTheme.surface,
        overflow: 'hidden',
      }}
    >
      <div style={{ minHeight: 36, padding: '0 10px', display: 'flex', alignItems: 'center', borderBottom: `1px solid ${workspaceTheme.border}`, background: workspaceTheme.surfaceMuted, color: workspaceTheme.navy, fontSize: 13, lineHeight: '18px', fontWeight: 700 }}>{title}</div>
      <nav style={{ display: 'grid' }}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={item.active ? 'page' : undefined}
            onClick={item.onClick}
            style={{
              minHeight: 42,
              display: 'grid',
              alignContent: 'center',
              gap: 1,
              padding: '5px 9px',
              border: 0,
              borderBottom: `1px solid ${workspaceTheme.divider}`,
              borderLeft: item.active ? `3px solid ${workspaceTheme.blue}` : '3px solid transparent',
              background: item.active ? '#EFF6FF' : workspaceTheme.surface,
              color: item.active ? workspaceTheme.navy : workspaceTheme.text,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <strong style={{ fontSize: 12, lineHeight: '16px', fontWeight: 700 }}>{item.label}</strong>
            {item.detail ? <span style={{ color: workspaceTheme.muted, fontSize: 10, lineHeight: '13px' }}>{item.detail}</span> : null}
          </button>
        ))}
      </nav>
      {footer ? <div style={{ padding: 8, borderTop: `1px solid ${workspaceTheme.border}`, background: '#F8FAFC' }}>{footer}</div> : null}
    </aside>
  );
}
