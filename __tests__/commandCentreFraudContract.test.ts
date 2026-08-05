import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('command centre fraud query contract', () => {
  const ROUTE = 'app/api/super-admin/command-centre/route.ts';

  it('queries fraud cases by canonical subject_company_id', () => {
    const route = readRepoFile(ROUTE);
    expect(route).toContain(".select('id, subject_company_id, status, created_at')");
    expect(route).not.toContain(".select('id, company_id, status, created_at')");
  });

  it('limits open fraud queue statuses to canonical active statuses', () => {
    const route = readRepoFile(ROUTE);
    expect(route).toContain(".in('status', ['open', 'investigating'])");
    expect(route).not.toContain('pending_review');
    expect(route).not.toContain('escalated');
  });
});
