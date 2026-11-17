import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { historicalJobAliases, selectHistoricalJobMatches } from '../lib/jobs/historicalReferenceLookup';

const driverModel = readFileSync('app/api/driver/mobile/_lib.ts', 'utf8');

describe('driver History searches the posting customer your_ref as a scoped legacy alias', () => {
  it('selects your_ref in the common authenticated driver job query', () => {
    expect(driverModel).toContain("  'your_ref',");
    expect(driverModel).toContain('your_ref?: string | null;');
  });
  it('preserves and matches the poster-supplied reference without rewriting any job identifier', () => {
    const jobs = [
      { id: 'db68930a-4488-430e-956b-27eb64f60297', your_ref: 'CLIENT-PO-2026', customer_ref: 'XD-0765' },
      { id: '81b67813-f31f-4350-8c19-84874bbafbe3', your_ref: 'OTHER-PO-2026', customer_ref: 'XD-0628' },
    ];
    expect(historicalJobAliases(jobs[0])).toContain('CLIENT-PO-2026');
    expect(selectHistoricalJobMatches(jobs, 'CLIENT-PO-2026')).toEqual([jobs[0]]);
    expect(selectHistoricalJobMatches(jobs.slice(1), 'CLIENT-PO-2026')).toEqual([]);
    expect(jobs[0].your_ref).toBe('CLIENT-PO-2026');
  });
  it('scopes both Driver web and mobile reference searches before applying the matcher', () => {
    for (const source of ['app/api/driver/mobile/jobs/route.ts', 'app/api/driver/web/jobs/route.ts']) {
      const code = readFileSync(source, 'utf8');
      expect(code).toContain(".eq('assigned_driver_id', driver.driverId)");
      expect(code).toContain('selectHistoricalJobMatches(all, referenceTerm)');
      expect(code).toContain('jobSelect');
    }
  });
});
