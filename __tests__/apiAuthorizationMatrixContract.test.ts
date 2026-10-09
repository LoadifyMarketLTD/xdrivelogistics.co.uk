import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('API workspace authorization matrix contract', () => {
  const helper = read('app/api/admin/_lib/requireCompanyCapability.ts');
  const workspaceRole = read('lib/workspaceRole.ts');

  it('derives company API authority from the canonical workspace capability matrix', () => {
    expect(helper).toContain('hasWorkspaceCapability');
    expect(helper).toContain(".eq('status', 'active')");
    expect(helper).toContain(".eq('companies.status', 'active')");
    expect(helper).toContain("fleet_manager: 'fleet_manager'");
    expect(helper).toContain("dispatcher: 'dispatcher'");
    expect(helper).toContain("finance: 'finance'");
    expect(helper).toContain("compliance: 'compliance'");
    expect(workspaceRole).toContain("| 'quotes.award'");
    expect(workspaceRole).toContain("| 'documents.company.manage'");
    expect(workspaceRole).toContain("| 'invoices.carrier.manage'");
  });

  it('uses capability checks for company, document, finance and Fleet mutation boundaries', () => {
    const expectations: Array<[string, string]> = [
      ['app/api/admin/companies/[id]/route.ts', "requireCompanyCapability(request, id, 'company.manage')"],
      ['app/api/admin/jobs/[id]/documents/route.ts', "requireCompanyCapability(request, parsed.data.companyId, 'documents.company.manage')"],
      ['app/api/admin/fleet/document-reminders/route.ts', "requireCompanyCapability(request, companyId, 'documents.company.manage')"],
      ['app/api/admin/drivers/[id]/future-position/route.ts', "requireCompanyCapability(request, parsed.data.companyId, 'drivers.manage')"],
      ['app/api/admin/vehicles/[id]/tracking-preferences/route.ts', "requireCompanyCapability(request, parsed.data.companyId, 'vehicles.manage')"],
      ['app/api/admin/return-journeys/route.ts', "requireCompanyCapability(request, parsed.data.companyId, 'fleet.positions.view')"],
    ];
    for (const [file, marker] of expectations) expect(read(file)).toContain(marker);
  });

  it('uses capability checks for commercial job, quote award and invoice mutation boundaries', () => {
    expect(read('app/api/admin/jobs/[id]/clone-prefill/route.ts')).toContain("requireCompanyCapability(request, companyId, 'loads.create')");
    expect(read('app/api/admin/jobs/[id]/route.ts')).toContain("requireCompanyCapability(request, parsed.data.companyId, 'loads.create')");
    expect(read('app/api/admin/jobs/[id]/manage/route.ts')).toContain("anyOf: ['loads.publish', 'jobs.dispatch']");
    expect(read('app/api/admin/bids/[id]/accept/route.ts')).toContain("requireCompanyCapability(request, jobCompanyId, 'quotes.award')");
    expect(read('app/api/admin/bids/[id]/reject/route.ts')).toContain("requireCompanyCapability(request, String(job.company_id), 'quotes.award')");
    expect(read('app/api/admin/invoices/route.ts')).toContain("anyOf: ['invoices.customer.manage', 'invoices.carrier.manage']");
    expect(read('app/api/admin/invoices/[id]/route.ts')).toContain("anyOf: ['invoices.customer.manage', 'invoices.carrier.manage']");
    expect(read('app/api/admin/invoices/[id]/adjustments/route.ts')).toContain("anyOf: ['invoices.customer.manage', 'invoices.carrier.manage']");
    expect(read('app/api/admin/invoices/[id]/lifecycle/route.ts')).toContain("anyOf: ['invoices.customer.manage', 'invoices.carrier.manage']");
    expect(read('app/api/admin/jobs/[id]/transition/route.ts')).toContain("requireCompanyCapability(request, operatingCompanyId, 'jobs.dispatch')");
    expect(read('app/api/admin/jobs/[id]/feedback/route.ts')).toContain("requireCompanyCapability(request, companyId, 'jobs.track')");
  });

  it('converges company settings endpoints on the same capability matrix', () => {
    expect(read('app/api/settings/company-blocked-members/route.ts')).toContain("requireCompanyCapability(request, companyId, 'company.manage')");
    expect(read('app/api/settings/company-operations/route.ts')).toContain("requireCompanyCapability(request, companyId, 'settings.manage')");
    expect(read('app/api/settings/company-finance/route.ts')).toContain("requireCompanyCapability(request, companyId, 'billing.manage')");
    expect(read('app/api/settings/departments/route.ts')).toContain("requireCompanyCapability(request, companyId, 'company.members.manage')");
  });

  it('keeps tenant ownership checks in addition to capability checks', () => {
    expect(read('app/api/admin/jobs/[id]/route.ts')).toContain("String(job.company_id) !== admin.companyId");
    expect(read('app/api/admin/jobs/[id]/manage/route.ts')).toContain("String(job.company_id) !== admin.companyId");
    expect(read('app/api/admin/vehicles/[id]/route.ts')).toContain(".eq('company_id', admin.companyId)");
    expect(read('app/api/admin/drivers/[id]/route.ts')).toContain(".eq('company_id', admin.companyId)");
  });
});
