import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { historicalJobAliases, selectHistoricalJobMatches } from '../lib/jobs/historicalReferenceLookup';

const model = readFileSync('app/api/driver/mobile/_lib.ts', 'utf8');
const mobile = readFileSync('app/api/driver/mobile/jobs/route.ts', 'utf8');
const web = readFileSync('app/api/driver/web/jobs/route.ts', 'utf8');
describe('Driver historical poster reference projection', () => {
  it('queries your_ref and represents it in the driver row', () => {
    expect(model).toContain("'your_ref',");
    expect(model).toContain('your_ref?: string | null;');
    expect(model).toContain('yourRef: row.your_ref || null');
  });
  it('preserves XDrive job reference instead of replacing it with customer reference', () => {
    expect(model).toContain('reference: `XDL-${row.id.slice(0, 8).toUpperCase()}`');
  });
  it('only queries authenticated assigned driver jobs on both surfaces', () => {
    for (const route of [mobile, web]) expect(route).toContain(".eq('assigned_driver_id', driver.driverId)");
  });
  it('matches your_ref within a pre-scoped set, without rewriting identifiers', () => {
    const jobs = [{ id: 'one', your_ref: 'CUSTOMER-A' }, { id: 'two', your_ref: 'CUSTOMER-B' }];
    expect(historicalJobAliases(jobs[0])).toContain('CUSTOMER-A');
    expect(selectHistoricalJobMatches(jobs, 'CUSTOMER-A')).toEqual([jobs[0]]);
    expect(jobs[0].id).toBe('one');
  });
});
