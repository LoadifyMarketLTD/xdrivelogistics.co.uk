import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(join(process.cwd(),'supabase/migrations/20260926164957_immutable_contractual_job_extras.sql'),'utf8');
const workspaceApi = readFileSync(join(process.cwd(),'app/api/workspace/jobs/[jobId]/extras/route.ts'),'utf8');
const driverExtrasApi = readFileSync(join(process.cwd(),'app/api/driver/mobile/jobs/[id]/extras/route.ts'),'utf8');
const driverSheet = readFileSync(join(process.cwd(),'app/api/driver/jobs/[jobId]/sheet/route.ts'),'utf8');
const workspaceSheet = readFileSync(join(process.cwd(),'app/api/workspace/jobs/[jobId]/sheet/route.ts'),'utf8');

describe('immutable contractual execution extras', () => {
  it('makes submitted extra content immutable and blocks deletion', () => {
    expect(migration).toContain('Execution extra submission content is immutable.');
    expect(migration).toContain('Execution extra records are immutable and cannot be deleted.');
    expect(migration).toContain('trg_guard_driver_job_extra_update');
    expect(migration).toContain('trg_block_driver_job_extra_delete');
  });

  it('requires complete contractual evidence before an extra can become approved', () => {
    expect(migration).toContain("status IN ('approved','invoiced')");
    expect(migration).toContain('contractual_amendment_id IS NOT NULL');
    expect(migration).toContain('contractual_snapshot IS NOT NULL');
    expect(migration).toContain("contractual_snapshot_hash ~ '^[0-9a-f]{64}$'");
    expect(migration).toContain('contractual_snapshot_version >= 2');
  });

  it('restricts extra decisions to the contractual transport buyer', () => {
    expect(migration).toContain('Only the contractual transport buyer may decide an execution extra.');
    expect(migration).toContain("lower(COALESCE(membership.role_in_company::text,'')) IN ('owner','admin','dispatcher')");
    expect(workspaceApi).toContain('Only an authorised member of the transport buyer may approve or reject execution extras.');
  });

  it('turns an approved extra into an accepted commercial amendment', () => {
    expect(migration).toContain("'execution_extra', v_snapshot");
    expect(migration).toContain('v_next_amount := round(v_agreement.agreed_amount + v_extra.amount_gbp, 2);');
    expect(migration).toContain('INSERT INTO public.job_commercial_agreement_amendments');
    expect(migration).toContain("SET status = 'accepted'");
    expect(migration).toContain('contractual_amendment_id = v_amendment.id');
    expect(migration).toContain('contractual_snapshot_version = v_amendment.version_number');
  });

  it('uses the atomic database decision function from the workspace API', () => {
    expect(workspaceApi).toContain(".rpc('fn_decide_driver_job_extra'");
    expect(workspaceApi).toContain("action: z.enum(['approve', 'reject'])");
    expect(workspaceApi).toContain("event_type: parsed.data.action === 'approve' ? 'execution_extra_approved' : 'execution_extra_rejected'");
  });

  it('exposes immutable contractual evidence to the driver mobile extras endpoint', () => {
    expect(driverExtrasApi).toContain('contractual_amendment_id');
    expect(driverExtrasApi).toContain('contractual_snapshot_hash');
    expect(driverExtrasApi).toContain('contractual_snapshot_version');
  });

  it('replaces the old hard-coded job-sheet extras gap with real contractual extras', () => {
    expect(driverSheet).toContain('extras: contractualExtras');
    expect(workspaceSheet).toContain('extras: contractualExtras');
    expect(driverSheet).not.toContain('No immutable waiting/loading/cancellation extras snapshot is exposed by the current verified data contract.');
    expect(workspaceSheet).not.toContain('No immutable waiting/loading/cancellation extras snapshot is exposed by the current verified data contract.');
  });

  it('keeps rejected extras outside the accepted commercial amendment chain', () => {
    const rejectBranch = migration.slice(migration.indexOf("IF p_action = 'reject' THEN"), migration.indexOf("IF v_extra.created_by IS NULL"));
    expect(rejectBranch).toContain("status = 'rejected'");
    expect(rejectBranch).not.toContain('job_commercial_agreement_amendments');
  });
});
