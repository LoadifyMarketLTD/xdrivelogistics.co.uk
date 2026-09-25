import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const diary = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/OperationsDiaryPage.tsx'), 'utf8');

describe('CX Operations Diary saved-search parity', () => {
  it('persists an explicit Save as Default filter selection locally for the signed-in browser', () => {
    expect(diary).toContain("xdrive:operations-diary:default-search");
    expect(diary).toContain('Save as Default');
    expect(diary).toContain('window.localStorage.setItem');
    expect(diary).toContain('window.localStorage.getItem');
    expect(diary).toContain('window.localStorage.removeItem');
  });

  it('restores saved filters into both editable and applied search state', () => {
    expect(diary).toContain('setSearch(restored)');
    expect(diary).toContain('setAppliedSearch(restored)');
  });
});
