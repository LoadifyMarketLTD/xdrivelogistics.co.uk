'use client';

import type { CSSProperties } from 'react';
import { WS_BLUE, WS_BLUE_BG, WS_TEXT_MUTED } from './tokens';

export interface WorkspaceTab {
  id: string;
  label: string;
  /** Shown as a pill chip next to the label when > 0 */
  count?: number;
}

interface Props {
  tabs: WorkspaceTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

const tabBase: CSSProperties = {
  padding: '0.65rem 0.9rem',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontSize: '0.78rem',
  fontWeight: 700,
  letterSpacing: '0.03em',
  marginBottom: '-1px',
};

/** The tab button row. Used inside WorkspaceHeader. */
export default function WorkspaceTabs({ tabs, activeTab, onTabChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 0 }}>
      {tabs.map((t) => {
        const active = t.id === activeTab;
        return (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            style={{
              ...tabBase,
              borderBottom: active ? `2px solid ${WS_BLUE}` : '2px solid transparent',
              color: active ? WS_BLUE : WS_TEXT_MUTED,
            }}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span
                style={{
                  marginLeft: '0.35rem',
                  background: active ? WS_BLUE_BG : '#F4F6F8',
                  color: active ? WS_BLUE : WS_TEXT_MUTED,
                  borderRadius: '8px',
                  padding: '0.05rem 0.4rem',
                  fontSize: '0.72rem',
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
