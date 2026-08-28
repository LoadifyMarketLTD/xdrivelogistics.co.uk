import fs from 'node:fs';
import path from 'node:path';

describe('CX vs XDrive Marketplace company quote identity', () => {
  const eligibility = fs.readFileSync(
    path.join(process.cwd(), 'app/api/driver/_lib/bidEligibility.ts'),
    'utf8',
  );
  const uniqueness = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260725183000_job_bids_active_quote_uniqueness.sql'),
    'utf8',
  );

  it('uses the carrier company as the active quote identity when a company exists', () => {
    expect(eligibility).toContain("await query.eq('company_id', driver.companyId)");
    expect(eligibility).not.toContain("query.eq('company_id', driver.companyId).eq('bidder_driver_id', driver.driverId)");
  });

  it('matches the database one-active-quote-per-company-and-job backstop', () => {
    expect(uniqueness).toContain('job_bids_active_company_job_unique');
    expect(uniqueness).toContain('ON public.job_bids (job_id, company_id)');
    expect(uniqueness).toContain("status IN ('submitted', 'accepted')");
  });
});
