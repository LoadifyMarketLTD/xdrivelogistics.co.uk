import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('Super Admin Support truth preservation', () => {
  it('requires active Platform Owner authority across Support reads and mutations', () => {
    const route = readRepoFile('app/api/super-admin/support/route.ts');
    expect(route).toContain('verifyPlatformOwner(request)');
    expect(route).toContain('Forbidden: active Platform Owner required.');
  });

  it('does not turn a missing or failed complaints source into zero complaints', () => {
    const route = readRepoFile('app/api/super-admin/support/route.ts');
    expect(route).toContain('Complaints source schema is not available in this environment.');
    expect(route).not.toContain("summary: { total: 0, low_rated: 0");
  });

  it('does not turn a missing or failed support-ticket source into a healthy empty registry', () => {
    const route = readRepoFile('app/api/super-admin/support/route.ts');
    expect(route).toContain('Support ticket schema is not available in this environment.');
    expect(route).not.toContain("summary: { total: 0, open: 0");
  });

  it('links invoice-dispute rows to the authoritative Invoice Inspector', () => {
    const page = readRepoFile('app/super-admin/support/disputes/page.tsx');
    expect(page).toContain("entityType: 'invoice'");
    expect(page).toContain('entityId: row.invoice_id');
    expect(page).toContain('authoritative Invoice Inspector');
  });
});
