'use client';

import type { ReactNode } from 'react';

export default function WorkspaceFilters({ children, onReset }: { children: ReactNode; onReset?: () => void }) {
  return (
    <section className="workspace-filters" aria-label="Filters">
      <div className="workspace-filters-grid">{children}</div>
      {onReset && <button type="button" className="workspace-secondary-button" onClick={onReset}>Clear filters</button>}
    </section>
  );
}
