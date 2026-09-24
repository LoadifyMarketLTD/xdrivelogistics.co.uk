import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const diary = fs.readFileSync(path.join(process.cwd(), 'app/driver/history/page.tsx'), 'utf8');

describe('CX Driver Diary saved-search parity', () => {
  it('persists Save as Default filters for the driver Diary', () => {
    expect(diary).toContain('Save as Default');
    expect(diary).toContain("xdrive:driver-diary:default-search");
    expect(diary).toContain('window.localStorage.setItem');
    expect(diary).toContain('window.localStorage.getItem');
    expect(diary).toContain('window.localStorage.removeItem');
  });

  it('restores saved filters into both editable and applied state', () => {
    expect(diary).toContain('setSearch(restored)');
    expect(diary).toContain('setAppliedSearch(restored)');
  });
});
