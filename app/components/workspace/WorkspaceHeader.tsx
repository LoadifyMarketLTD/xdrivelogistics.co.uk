'use client';

import type { CSSProperties, ReactNode } from 'react';
import WorkspaceTabs, { type WorkspaceTab } from './WorkspaceTabs';
import { WS_SURFACE, WS_BORDER } from './tokens';

interface Props {
  tabs: WorkspaceTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  /** Optional right-side slot (e.g. "↻ Refresh" button, "+ New" button) */
  action?: ReactNode;
}

const headerStyle: CSSProperties = {
  background: WS_SURFACE,
  borderBottom: `1px solid ${WS_BORDER}`,
  padding: '0 1rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexShrink: 0,
};

/**
 * Sticky tab-bar at the top of WorkspaceMain.
 * Contains the tab row on the left and an optional action on the right.
 */
export default function WorkspaceHeader({ tabs, activeTab, onTabChange, action }: Props) {
  return (
    <div style={headerStyle}>
      <WorkspaceTabs tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
      {action != null && <div>{action}</div>}
    </div>
  );
}
