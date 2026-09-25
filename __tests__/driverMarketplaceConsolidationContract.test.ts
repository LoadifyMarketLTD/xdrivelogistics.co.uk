import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Driver Marketplace consolidation contract', () => {
  it('rejects expired Exchange loads across Driver and Company quote paths', () => {
    const eligibility = read('app/api/driver/_lib/bidEligibility.ts');
    const search = read('app/api/driver/search-loads/route.ts');
    const company = read('app/api/marketplace/company/route.ts');
    expect(eligibility).toContain('exchange_expires_at');
    expect(eligibility).toContain("denialReasons.push('job_exchange_expired')");
    expect(search).toContain('exchangePostActive(row)');
    expect(company).toContain('exchangePostActive(job.exchange_expires_at)');
  });

  it('enforces one active quote per carrier company while preserving personal quote history', () => {
    const eligibility = read('app/api/driver/_lib/bidEligibility.ts');
    const bids = read('app/api/driver/mobile/bids/route.ts');
    expect(eligibility).toContain("await query.eq('company_id', driver.companyId)");
    expect(bids).toContain("scope === 'active-company'");
    expect(bids).toContain(".select('job_id')");
    expect(bids).toContain("Driver mobile is the named driver's personal quote history");
  });

  it('routes current mobile load discovery and quoting through device/session-gated server APIs', () => {
    const nearby = read('app/api/driver/mobile/nearby-jobs/route.ts');
    const bids = read('app/api/driver/mobile/bids/route.ts');
    const mobileAuth = read('app/api/driver/mobile/_lib.ts');
    expect(nearby).toContain('const driver = await requireDriver(request)');
    expect(bids).toContain('const driver = await requireDriver(request)');
    expect(bids).toContain('submitDriverQuote');
    expect(mobileAuth).toContain('enforceActiveNativeDeviceBinding');
    expect(mobileAuth).toContain("request.headers.get('x-xdrive-installation-id')");
  });

  it('fails closed on marketplace discovery when commercial bidding is explicitly revoked', () => {
    const nearby = read('app/api/driver/mobile/nearby-jobs/route.ts');
    const loads = read('app/api/driver/marketplace/loads/route.ts');
    const search = read('app/api/driver/search-loads/route.ts');
    for (const source of [nearby, loads, search]) {
      expect(source).toContain('if (!driver.canCommercialBid)');
      expect(source).toContain('Commercial marketplace access is not enabled for this Driver account.');
      expect(source).toContain('403');
    }
  });
});
