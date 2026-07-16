'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export default function WorkspaceDrawer({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="workspace-overlay workspace-drawer-overlay" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <aside className="workspace-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></header>
        <div>{children}</div>
      </aside>
    </div>
  );
}
