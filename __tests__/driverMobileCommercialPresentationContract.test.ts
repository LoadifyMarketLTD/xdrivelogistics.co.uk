import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('driver mobile commercial presentation', () => {
  it('presents owner company identity and payment terms on assigned jobs', () => {
    const route = read('app/api/driver/mobile/jobs/route.ts');
    const lib = read('app/api/driver/mobile/_lib.ts');

    expect(route).toContain(".from('companies')");
    expect(route).toContain(".select('id, name, xd_id')");
    expect(route).toContain('companyName: ownerCompany?.name ?? undefined');
    expect(route).toContain('companyXdId: posterMemberId ?? ownerCompany?.xd_id ?? undefined');
    expect(route).toContain(".from('profiles')");
    expect(route).toContain(".select('user_id,xd_id')");
    expect(lib).toContain("'payment_terms'");
    expect(lib).toContain("paymentTerms: row.payment_terms || ''");
  });
});
