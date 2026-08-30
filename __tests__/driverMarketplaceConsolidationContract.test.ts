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
    expect(bids).toContain('Driver mobile is the named driver\'s personal quote history');
  });

  it('routes Expo Live Loads and quoting through the device-bound API client', () => {
    const liveLoads = read('apps/driver-mobile/src/api/liveLoads.ts');
    expect(liveLoads).toContain("import { apiRequest } from './client'");
    expect(liveLoads).toContain("apiRequest<LiveLoadsResponse>(`/api/driver/mobile/nearby-jobs?");
    expect(liveLoads).toContain("apiRequest<{ activeJobIds?: string[] }>('/api/driver/mobile/bids?scope=active-company')");
    expect(liveLoads).not.toContain(".from('job_bids')");
  });
});
