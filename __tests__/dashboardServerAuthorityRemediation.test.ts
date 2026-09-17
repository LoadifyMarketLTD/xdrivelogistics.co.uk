import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('dashboard server-authority remediation contract', () => {
  it('routes destructive Fleet resource actions through authenticated server APIs', () => {
    const drivers = readRepoFile('app/admin/drivers/page.tsx');
    const vehicles = readRepoFile('app/admin/vehicles/page.tsx');

    expect(drivers).toContain('/api/admin/drivers/${encodeURIComponent(driver.id)}');
    expect(drivers).not.toMatch(/\.from\(['"]drivers['"]\)[\s\S]{0,120}\.delete\(\)/);
    expect(vehicles).toContain('/api/admin/vehicles/${encodeURIComponent(vehicleId)}');
    expect(vehicles).not.toMatch(/\.from\(['"]vehicles['"]\)[\s\S]{0,120}\.delete\(\)/);
  });

  it('uses canonical verified company registration instead of browser company authority writes', () => {
    const companies = readRepoFile('app/admin/companies/page.tsx');

    expect(companies).toContain('registerValidatedCompany');
    expect(companies).toContain('Verify & Register');
    expect(companies).not.toMatch(/\.from\(['"]companies['"]\)[\s\S]{0,120}\.insert\(/);
    expect(companies).not.toMatch(/\.from\(['"]company_memberships['"]\)[\s\S]{0,120}\.upsert\(/);
  });

  it('moves Admin customer quote mutations and conversion behind server authority', () => {
    const quotes = readRepoFile('app/admin/quotes/page.tsx');
    const api = readRepoFile('app/api/admin/quotes/route.ts');
    const convert = readRepoFile('app/api/admin/quotes/[id]/convert/route.ts');

    expect(quotes).toContain("fetch('/api/admin/quotes'");
    expect(quotes).not.toMatch(/\.from\(['"]quotes['"]\)/);
    expect(api).toContain(".from('quotes')");
    expect(api).toContain('requireCompanyAdmin');
    expect(convert).toContain(".from('jobs')");
    expect(convert).toContain('compensation failed');
  });

  it('persists job attachment metadata through a tenant-authorized server endpoint', () => {
    const jobs = readRepoFile('app/admin/jobs/page.tsx');
    const route = readRepoFile('app/api/admin/jobs/[id]/documents/route.ts');
    const migration = readRepoFile('supabase/migrations/20260917175510_align_job_documents_canonical_contract_20260917.sql');

    expect(jobs).toContain('/documents`');
    expect(jobs).not.toMatch(/\.from\(['"]job_documents['"]\)[\s\S]{0,120}\.insert\(/);
    expect(route).toContain(".from('job_documents')");
    expect(route).toContain(".from('load-documents')");
    expect(route).toContain('requireCompanyAdmin');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS doc_type text');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS file_path text');
    expect(migration).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE public.job_documents FROM authenticated');
  });

  it('uses the existing atomic owner delete contract for Admin job deletion', () => {
    const job = readRepoFile('app/admin/jobs/[id]/page.tsx');
    const ownerRoute = readRepoFile('app/api/workspace/jobs/[jobId]/owner/route.ts');

    expect(job).toContain('/api/workspace/jobs/${encodeURIComponent(jobId)}/owner');
    expect(job).not.toMatch(/\.from\(['"]jobs['"]\)[\s\S]{0,120}\.delete\(\)/);
    expect(ownerRoute).toContain("client.rpc('delete_unbid_exchange_job_atomic'");
  });

  it('moves Driver quote withdrawal and notification mutations behind server authority', () => {
    const quotes = readRepoFile('app/driver/quotes/page.tsx');
    const notifications = readRepoFile('app/driver/_components/DriverNotificationRegister.tsx');

    expect(quotes).toContain('/withdraw`');
    expect(quotes).not.toMatch(/\.from\(['"]job_bids['"]\)[\s\S]{0,120}\.update\(/);
    expect(notifications).toContain("fetch('/api/driver/notifications'");
    expect(notifications).not.toMatch(/\.from\(['"]notifications['"]\)/);
  });

  it('backs Customer document alerts with canonical POD and delivery-evidence signals', () => {
    const dashboard = readRepoFile('app/customer/CustomerDashboardHome.tsx');
    const workspaceData = readRepoFile('app/components/workspace/useCompanyWorkspaceData.ts');

    expect(dashboard).toContain('metrics.documentAlertJobs.length');
    expect(dashboard).toContain('job.pod_required === true');
    expect(dashboard).toContain("broker_pod_review_status");
    expect(workspaceData).toContain('pod_generated, has_delivery_evidence, broker_pod_review_status');
  });


  it('moves Admin job publish, direct booking and cancellation behind server authority', () => {
    const jobs = readRepoFile('app/admin/jobs/page.tsx');
    const manage = readRepoFile('app/api/admin/jobs/[id]/manage/route.ts');

    expect(jobs).toContain('/manage`');
    expect(jobs).not.toMatch(/\.from\(['\"]jobs['\"]\)[\s\S]{0,160}\.update\(/);
    expect(manage).toContain('requireCompanyAdmin');
    expect(manage).toContain("cancel_unassigned_exchange_job_atomic");
    expect(manage).toContain("request_awarded_job_cancellation_atomic");
    expect(manage).toContain("exchange_visibility: visibility");
    expect(manage).toContain("direct_invite_company_id: directInviteCompanyId");
  });

});
