import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

describe('Admin Job detail server authority', () => {
  it('routes posting-company edits through the canonical owner mutation contract', () => {
    const page = read('app/admin/jobs/[id]/page.tsx');
    const canonicalEdit = read('app/api/workspace/jobs/[jobId]/owner/route.ts');
    const editPage = read('app/admin/jobs/[id]/edit/page.tsx');
    const manageRoute = read('app/api/admin/jobs/[id]/manage/route.ts');

    expect(page).not.toMatch(/\.from\(['"]jobs['"]\)[\s\S]{0,160}\.update\(/);
    expect(page).toContain('`/admin/jobs/${encodeURIComponent(jobId)}/edit`');
    expect(editPage).toContain('mode="admin"');
    expect(editPage).toContain('at any lifecycle stage');
    expect(canonicalEdit).toContain('const editReason: string | null = null');
    expect(canonicalEdit).toContain('status: originalJob.status');
    expect(canonicalEdit).toContain('current_status: originalJob.current_status');
    expect(canonicalEdit).not.toContain('Commercial or route details cannot be changed after award');
    expect(page).toContain("action: isPublished ? 'unpublish' : 'publish'");
    expect(page).toContain('Status changes use operational lifecycle actions.');
    expect(page).not.toContain('STATUS_OPTIONS.map');
    expect(manageRoute).toContain("action: z.literal('unpublish')");
  });
});