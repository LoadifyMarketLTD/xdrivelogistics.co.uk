import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('finance server-authority remediation', () => {
  it('creates Admin invoices through a server route, not browser table writes', () => {
    const page = readRepoFile('app/admin/invoices/new/page.tsx');
    const route = readRepoFile('app/api/admin/invoices/route.ts');

    expect(page).toContain("fetch('/api/admin/invoices'");
    expect(page).not.toMatch(/\.from\(['"]invoices['"]\)[\s\S]{0,120}\.insert\(/);
    expect(route).toContain("['owner', 'admin', 'dispatcher', 'finance']");
    expect(route).toContain("late_fee: 0");
    expect(route).toContain('vatRegistered ? parsed.data.vatRate : 0');
    expect(route).toContain(".from('jobs')");
    expect(route).toContain('This company is not a party to the related job.');
  });
  it('edits only draft Admin invoices through server authority and keeps late_fee numeric', () => {
    const page = readRepoFile('app/admin/invoices/[id]/page.tsx');
    const route = readRepoFile('app/api/admin/invoices/[id]/route.ts');
    const types = readRepoFile('lib/types/database.ts');

    expect(page).toContain('/api/admin/invoices/');
    expect(page).not.toContain('saveInvoiceWithSchemaCompat');
    expect(route).toContain("Only draft invoices can be edited.");
    expect(route).toContain("['owner', 'admin', 'dispatcher', 'finance']");
    expect(route).toContain('late_fee: 0');
    expect(types).toContain('late_fee: number;');
  });
});
