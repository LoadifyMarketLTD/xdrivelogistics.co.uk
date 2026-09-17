import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

describe('Admin Job detail server authority', () => {
  it('keeps edits and Exchange visibility behind controlled routes', () => {
    const page = read('app/admin/jobs/[id]/page.tsx');
    const editRoute = read('app/api/admin/jobs/[id]/route.ts');
    const manageRoute = read('app/api/admin/jobs/[id]/manage/route.ts');

    expect(page).not.toMatch(/\.from\(['"]jobs['"]\)[\s\S]{0,160}\.update\(/);
    expect(page).toContain("method: 'PATCH'");
    expect(page).toContain("action: isPublished ? 'unpublish' : 'publish'");
    expect(page).toContain('Status changes use operational lifecycle actions.');
    expect(page).not.toContain('STATUS_OPTIONS.map');
    expect(editRoute).toContain('Commercial or route details cannot be changed after award');
    expect(editRoute).not.toContain('status: parsed.data');
    expect(manageRoute).toContain("action: z.literal('unpublish')");
  });
});
