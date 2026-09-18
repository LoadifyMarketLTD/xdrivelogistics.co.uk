import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

describe('Admin Job creation server authority', () => {
  it('creates Admin jobs through the canonical job endpoint', () => {
    const page = read('app/admin/jobs/page.tsx');
    const route = read('app/api/jobs/create/route.ts');

    expect(page).toContain("fetch('/api/jobs/create'");
    expect(page).not.toMatch(/\.from\(['"]jobs['"]\)[\s\S]{0,160}\.insert\(/);
    expect(route).toContain("mode: z.enum(['broker', 'customer', 'admin'])");
    expect(route).toContain("jobStatus: z.enum(['draft', 'posted'])");
    expect(route).toContain("visibility: z.enum(['private', 'exchange'])");
    expect(route).toContain("requestedStatus === 'draft' ? 'private' : requestedVisibility");
    expect(route).toContain('document_checklist: input.documentChecklist');
    expect(route).toContain('delivery_tail_lift_required: input.deliveryTailLift');
  });
});
