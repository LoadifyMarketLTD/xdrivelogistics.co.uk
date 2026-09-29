import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const jobsCreate = read('app/api/jobs/create/route.ts');
const requireCompanyAdmin = read('app/api/admin/_lib/requireCompanyAdmin.ts');
const adminManage = read('app/api/admin/jobs/[id]/manage/route.ts');
const driverLib = read('app/api/driver/mobile/_lib.ts');
const driverEligibility = read('app/api/driver/_lib/operationalEligibility.ts');
const submitDriverQuote = read('app/api/driver/_lib/submitQuote.ts');
const nearbyJobs = read('app/api/driver/mobile/nearby-jobs/route.ts');
const workflowUi = read('app/admin/workflowUi.tsx');

describe('Company Driver commercial boundary', () => {
  it('never allows company drivers to post new transport work', () => {
    expect(jobsCreate).toContain(".in('role_in_company', ['owner', 'admin', 'dispatcher'])");
    expect(jobsCreate).toContain('You cannot post loads for this company workspace.');
    expect(jobsCreate).not.toContain("'driver']");
  });

  it('never allows company drivers to republish or direct-invite company jobs', () => {
    expect(requireCompanyAdmin).toContain("const ADMIN_ROLES = ['owner', 'admin', 'dispatcher'] as const;");
    expect(adminManage).toContain('requireCompanyAdmin(request, parsed.data.companyId)');
  });

  it('keeps company_driver as an explicit driver identity under its company', () => {
    expect(driverLib).toContain('companyId: string | null');
    expect(driverEligibility).toContain("canonicalDriverType === 'company_driver'");
    expect(driverEligibility).toContain("['individual_driver', 'company_driver']");
    expect(driverEligibility).toContain('driver_company_membership_not_active');
  });

  it('allows an approved company driver to receive Marketplace work and alerts when commercial bidding is enabled', () => {
    expect(nearbyJobs).toContain('if (!driver.canCommercialBid)');
    expect(nearbyJobs).toContain('canQuote: true');
    expect(nearbyJobs).toContain("direct_invite_company_id.eq.${driver.companyId}");
    expect(workflowUi).toContain("{ id: 'marketplace', label: 'Loads'");
    expect(workflowUi).not.toContain("{ id: 'post_load'");
  });

  it('submits driver quotes in the company context rather than creating a personal buyer obligation', () => {
    expect(submitDriverQuote).toContain('getStripeCommercialReadiness(supabaseAdmin, driver.companyId)');
    expect(submitDriverQuote).toContain('getCommercialLegalReadiness(supabaseAdmin, driver.companyId)');
    expect(submitDriverQuote).toContain('Your carrier business must complete and activate Stripe before quoting for transport work.');
    expect(submitDriverQuote).toContain('driver.companyId');
  });
});
