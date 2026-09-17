import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('driver finance invoice contract', () => {
  it('uses the live numeric late-fee and canonical VAT/job authority contract', () => {
    const route = readRepoFile('app/api/driver/finance/invoices/route.ts');

    expect(route).toContain('late_fee: 0');
    expect(route).not.toContain("late_fee: typeof late_fee === 'string'");
    expect(route).toContain('vatRegistered ? requestedVatRate : 0');
    expect(route).toContain(".from('companies')");
    expect(route).toContain(".from('jobs')");
    expect(route).toContain('Your company is not a party to the related job.');
    expect(route).toContain('An active company is required to create invoices.');
  });
});
