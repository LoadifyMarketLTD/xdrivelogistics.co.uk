import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

const preAwardClientSurfaces = [
  'app/driver/page.tsx',
  'app/driver/loads/page.tsx',
  'app/driver/loads/[id]/page.tsx',
  'app/driver/loads/search/page.tsx',
  'app/components/workspace/CompanyMarketplaceExchange.tsx',
];

const privacyMigration = 'supabase/migrations/20260815091500_marketplace_preaward_privacy_guard.sql';

describe('Marketplace consumer boundary', () => {
  it.each(preAwardClientSurfaces)('%s does not SELECT jobs directly from the browser', (relative) => {
    const source = fs.readFileSync(path.join(root, relative), 'utf8');
    expect(source).not.toMatch(/\.from\(['"]jobs['"]\)/);
  });

  it('keeps pre-award Marketplace reads behind sanitising server routes', () => {
    const driverApi = fs.readFileSync(path.join(root, 'app/api/driver/marketplace/loads/route.ts'), 'utf8');
    const companyApi = fs.readFileSync(path.join(root, 'app/api/marketplace/company/route.ts'), 'utf8');
    const searchApi = fs.readFileSync(path.join(root, 'app/api/driver/search-loads/route.ts'), 'utf8');

    for (const source of [driverApi, companyApi, searchApi]) {
      expect(source).toContain('publicOutcode');
      expect(source).toContain('publicQuoteNotes');
    }
    expect(driverApi).toContain('pickup_area');
    expect(companyApi).toContain('publicSearchProjection');
    expect(searchApi).toContain('publicAreaLabel');
  });

  it('routes Android Marketplace and quote reads through XDrive server projections', () => {
    const viewModel = fs.readFileSync(
      path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/DriverViewModel.kt'),
      'utf8',
    );
    const secureApi = fs.readFileSync(
      path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/data/SecureDriverCommercialApi.kt'),
      'utf8',
    );

    expect(viewModel).toContain('SecureDriverCommercialApi');
    expect(viewModel).toContain('commercialApi.loadDriverJobs(session)');
    expect(viewModel).toContain('commercialApi.loadDriverBids(session)');
    expect(viewModel).toContain('commercialApi.submitJobQuote(session, jobId, amount, note)');
    expect(viewModel).not.toContain('api.loadAssignedJobs(session, profile)');
    expect(viewModel).not.toContain('api.loadDriverBids(session, profile)');
    expect(viewModel).not.toContain('api.submitJobQuote(session, profile');

    expect(secureApi).toContain('/api/driver/mobile/nearby-jobs?limit=100');
    expect(secureApi).toContain('/api/driver/mobile/jobs?scope=all&limit=100');
    expect(secureApi).toContain('/api/driver/mobile/bids');
    expect(secureApi).not.toContain('/rest/v1/jobs');
    expect(secureApi).not.toContain('/rest/v1/job_bids');
  });

  it('keeps full assigned execution jobs assignment-gated on the server', () => {
    const mobileJobs = fs.readFileSync(path.join(root, 'app/api/driver/mobile/jobs/route.ts'), 'utf8');
    expect(mobileJobs).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(mobileJobs).toContain("scope !== 'all'");
  });

  it('stages a restrictive DB guard for posted and quoted pre-award Marketplace rows', () => {
    const migration = fs.readFileSync(path.join(root, privacyMigration), 'utf8');

    expect(migration).toContain('AS RESTRICTIVE');
    expect(migration).toContain("IN ('posted', 'quoted')");
    expect(migration).toContain('awarded_carrier_company_id IS NULL');
    expect(migration).toContain('jobs_preaward_marketplace_privacy_guard');
    expect(migration).toContain('can_read_marketplace_execution_job');
    expect(migration).toContain('can_quote_marketplace_job');
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('direct_invite_company_id = p_bidder_company_id');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.can_quote_marketplace_job(uuid, uuid) TO authenticated');
  });
});
