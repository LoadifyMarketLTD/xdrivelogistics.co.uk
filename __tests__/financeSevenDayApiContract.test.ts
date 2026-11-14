import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const canonical = "z.enum(['Pay now', '7 days', '14 days', '30 days'])";

describe('Finance seven-day API acceptance contract', () => {
  it.each([
    'app/api/admin/invoices/route.ts',
    'app/api/admin/invoices/[id]/route.ts',
    'app/api/jobs/create/route.ts',
    'app/api/workspace/jobs/[jobId]/amendments/route.ts',
  ])('accepts all four approved terms in %s', (path) => {
    const source = read(path);
    expect(source).toContain(canonical);
    expect(source).not.toContain("z.enum(['Pay now', '14 days', '30 days'])");
  });

  it('covers both job creation variants', () => {
    expect(read('app/api/jobs/create/route.ts').split(canonical).length - 1).toBe(2);
  });

  it.each([
    'app/api/driver/finance/invoices/[id]/draft/route.ts',
    'app/api/settings/company-finance/route.ts',
    'app/components/workspace/CompanyFinanceSettingsPanel.tsx',
  ])('explains the four terms in %s', (path) => {
    expect(read(path)).toContain('Pay now, 7 days, 14 days or 30 days');
  });
});