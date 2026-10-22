import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('Admin quotes capability alignment', () => {
  it('aligns the quotes register API with the canonical quotes.submit route capability', () => {
    const collection = read('app/api/admin/quotes/route.ts');
    const item = read('app/api/admin/quotes/[id]/route.ts');

    expect(collection).toContain("requireCompanyCapability(request, companyId, 'quotes.submit')");
    expect(collection).toContain("requireCompanyCapability(request, parsed.data.companyId, 'quotes.submit')");
    expect(item).toContain("requireCompanyCapability(request, parsed.data.companyId, 'quotes.submit')");
    expect(collection).not.toContain("'company.manage'");
    expect(item).not.toContain("'company.manage'");
  });
});
