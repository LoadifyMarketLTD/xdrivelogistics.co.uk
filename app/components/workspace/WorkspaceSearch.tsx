'use client';

import { Search } from 'lucide-react';

export default function WorkspaceSearch({ value, onChange, placeholder = 'Search workspace' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="workspace-search">
      <Search size={15} aria-hidden="true" />
      <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}
