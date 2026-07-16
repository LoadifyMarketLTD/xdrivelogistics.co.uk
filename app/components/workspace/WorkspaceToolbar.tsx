'use client';

import type { ReactNode } from 'react';

export default function WorkspaceToolbar({ title, description, children }: { title?: string; description?: string; children?: ReactNode }) {
  return (
    <div className="workspace-toolbar">
      <div>{title && <h2>{title}</h2>}{description && <p>{description}</p>}</div>
      {children && <div className="workspace-toolbar-actions">{children}</div>}
    </div>
  );
}
