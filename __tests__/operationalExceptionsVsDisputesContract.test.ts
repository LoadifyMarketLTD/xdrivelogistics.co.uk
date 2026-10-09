import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read=(relative:string)=>fs.readFileSync(path.join(process.cwd(),relative),'utf8');

describe('operational exceptions versus disputes completion',()=>{
  const migration=read('supabase/migrations/20261009201500_operational_exceptions_vs_disputes.sql');
  const jobApi=read('app/api/workspace/jobs/[jobId]/exceptions/route.ts');
  const listApi=read('app/api/workspace/exceptions/route.ts');
  const panel=read('app/components/workspace/JobOperationalExceptionsPanel.tsx');
  const incidents=read('app/admin/incidents/page.tsx');
  const sheet=read('app/components/workspace/CompanyJobSheetPanel.tsx');
  const customerDisputes=read('app/api/customer/disputes/route.ts');
  const brokerDisputes=read('app/api/broker/disputes/[id]/route.ts');

  it('adds a persistent operational exception register without replacing formal job disputes',()=>{
    expect(migration).toContain('create table if not exists public.job_operational_exceptions');
    expect(migration).toContain('These are deliberately separate from formal commercial job_disputes');
    expect(customerDisputes).toContain(".from('job_disputes')");
    expect(brokerDisputes).toContain(".from('job_disputes')");
  });

  it('scopes exception access to active company participants and operator roles',()=>{
    expect(jobApi).toContain('This company is not a participant in the booking.');
    expect(jobApi).toContain(".from('company_memberships')");
    expect(jobApi).toContain("const MANAGER_ROLES = new Set(['owner', 'admin', 'dispatcher', 'fleet_manager'])");
    expect(jobApi).toContain("kind: 'operational_exception'");
  });

  it('supports report, monitor, resolve and reopen without mutating commercial dispute state',()=>{
    expect(jobApi).toContain("action: z.enum(['monitor', 'resolve', 'reopen'])");
    expect(jobApi).toContain(".from('job_operational_exceptions')");
    expect(jobApi).not.toContain(".from('job_disputes').update");
    expect(panel).toContain('Report Exception');
    expect(panel).toContain('Monitor');
    expect(panel).toContain('Resolve');
    expect(panel).toContain('Reopen');
  });

  it('makes the distinction explicit in booking details and the Incidents register',()=>{
    expect(sheet).toContain("{ id: 'exception', label: 'Exceptions' }");
    expect(sheet).toContain('<JobOperationalExceptionsPanel');
    expect(panel).toContain('Operational exceptions are not commercial disputes.');
    expect(incidents).toContain('Persistent execution exceptions');
    expect(incidents).toContain('Formal commercial disagreements remain in Disputes.');
  });

  it('keeps company-wide exception listing within participant booking scope',()=>{
    expect(listApi).toContain('assigned_company_id.eq.');
    expect(listApi).toContain('awarded_carrier_company_id.eq.');
    expect(listApi).toContain(".from('job_operational_exceptions')");
  });
});
