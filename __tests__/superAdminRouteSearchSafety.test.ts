import { describe, expect, it } from 'vitest';

import { applyCompanyStatusFilter, buildCompanySearchPattern } from '../app/api/super-admin/companies/route';
import { buildJobSearchPattern } from '../app/api/super-admin/operations/route';

describe('super-admin route search safety', () => {
  it('preserves reserved characters in company search patterns', () => {
    expect(buildCompanySearchPattern('ACME, Ltd')).toBe('%ACME, Ltd%');
    expect(buildCompanySearchPattern('Quote "A" (North) 12.5%')).toBe('%Quote "A" (North) 12.5%%');
  });

  it('preserves reserved characters in operations search patterns', () => {
    expect(buildJobSearchPattern('London, UK')).toBe('%London, UK%');
    expect(buildJobSearchPattern('SW1A 1AA')).toBe('%SW1A 1AA%');
  });

  it('applies canonical pending-company filtering at database level', () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const query = {
      eq: (column: string, value: string) => {
        calls.push({ method: 'eq', args: [column, value] });
        return query;
      },
      in: (column: string, values: string[]) => {
        calls.push({ method: 'in', args: [column, values] });
        return query;
      },
    };

    applyCompanyStatusFilter(query, 'pending');

    expect(calls).toEqual([
      { method: 'in', args: ['status', ['pending', 'pending_approval']] },
    ]);
  });
});
