import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read=(relative:string)=>fs.readFileSync(path.join(process.cwd(),relative),'utf8');

describe('Fleet / Dispatcher manual operational status completion',()=>{
  const transition=read('app/api/admin/jobs/[id]/transition/route.ts');
  const sheetApi=read('app/api/workspace/jobs/[jobId]/sheet/route.ts');
  const panel=read('app/components/workspace/CompanyJobSheetPanel.tsx');

  it('keeps operator status authority restricted to the executing company and Fleet operator roles',()=>{
    expect(transition).toContain(".in('role_in_company', ['owner', 'admin', 'fleet_manager', 'dispatcher'])");
    expect(transition).toContain('const operatingCompanyId = job.awarded_carrier_company_id ?? job.company_id');
    expect(sheetApi).toContain('viewerRole');
    expect(panel).toContain("OPERATOR_STATUS_ROLES = new Set(['owner', 'admin', 'fleet_manager', 'dispatcher'])");
    expect(panel).toContain('sheet.viewerCompanyId === operatingCompanyId');
  });

  it('uses the canonical explicit acceptance lifecycle instead of skipping from allocation directly into execution',()=>{
    expect(transition).toContain("allocated: 'accepted'");
    expect(transition).toContain("accepted: 'on_my_way'");
    expect(transition).not.toContain("awarded: 'on_my_way'");
    expect(panel).toContain("allocated: 'accepted'");
    expect(panel).toContain("accepted: 'on_my_way'");
  });

  it('preserves optimistic concurrency, assignment checks and POD completion gate',()=>{
    expect(transition).toContain('parsed.data.expectedStatus');
    expect(transition).toContain(".eq('status', job.status)");
    expect(transition).toContain("updateQuery.eq('current_status', job.current_status)");
    expect(transition).toContain('Assign an approved driver before starting job execution.');
    expect(transition).toContain('Complete POD before completing this job');
    expect(panel).toContain('expectedStatus: sheet.status');
    expect(panel).toContain('operatorNextStatus === \'completed\' && !podCompleteForOperator');
  });

  it('provides sequential manual controls in the shared carrier job Progress view without arbitrary status jumping',()=>{
    expect(panel).toContain('Operator status control');
    expect(panel).toContain('/api/admin/jobs/${encodeURIComponent(jobId)}/transition');
    expect(panel).toContain('Sequential transition only.');
    expect(panel).toContain('OPERATOR_STATUS_ACTION');
    expect(panel).not.toContain('All operational statuses');
  });

  it('writes operator transition provenance into the canonical job event log',()=>{
    expect(transition).toContain("source: 'operator_api'");
    expect(transition).toContain('previous_status: currentStatus');
    expect(transition).toContain('next_status: parsed.data.nextStatus');
    expect(transition).toContain('role: membership.role_in_company');
  });
});
