'use client';

import type { ReactNode } from 'react';
import type { RoleCapabilities } from '@/lib/roleCapabilities';

export type WorkspaceAction = {
  id: string;
  label: string;
  capability: keyof RoleCapabilities;
  onClick: () => void;
  icon?: ReactNode;
  tone?: 'primary' | 'secondary' | 'danger';
};

export default function WorkspaceActions({ capabilities, actions }: { capabilities: RoleCapabilities; actions: WorkspaceAction[] }) {
  const available = actions.filter((action) => capabilities[action.capability]);
  if (available.length === 0) return null;
  return (
    <div className="workspace-actions">
      {available.map((action) => (
        <button key={action.id} type="button" className={`workspace-${action.tone ?? 'secondary'}-button`} onClick={action.onClick}>
          {action.icon}{action.label}
        </button>
      ))}
    </div>
  );
}
