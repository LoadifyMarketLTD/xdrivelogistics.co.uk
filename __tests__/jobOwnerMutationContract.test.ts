import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const route = fs.readFileSync(path.join(root, 'app/api/workspace/jobs/[jobId]/owner/route.ts'), 'utf8');
const page = fs.readFileSync(path.join(root, 'app/customer/jobs/[id]/page.tsx'), 'utf8');
const editPage = fs.readFileSync(path.join(root, 'app/customer/jobs/[id]/edit/page.tsx'), 'utf8');
const brokerEditPage = fs.readFileSync(path.join(root, 'app/broker/jobs/[id]/edit/page.tsx'), 'utf8');
const adminEditPage = fs.readFileSync(path.join(root, 'app/admin/jobs/[id]/edit/page.tsx'), 'utf8');
const brokerLoadsPage = fs.readFileSync(path.join(root, 'app/broker/loads/page.tsx'), 'utf8');
const brokerJobsPage = fs.readFileSync(path.join(root, 'app/broker/jobs/page.tsx'), 'utf8');
const adminJobPage = fs.readFileSync(path.join(root, 'app/admin/jobs/[id]/page.tsx'), 'utf8');
const editForm = fs.readFileSync(path.join(root, 'app/components/workspace/JobOwnerEditForm.tsx'), 'utf8');

describe('posting-company owner edit/delete contract', () => {
  it('authorises mutations server-side against the posting company membership', () => {
    expect(route).toContain(".eq('company_id', ownerCompanyId)");
    expect(route).toContain(".eq('user_id', userId)");
    expect(route).toContain(".in('role_in_company', ['owner', 'admin', 'dispatcher'])");
    expect(route).toContain('Only the posting company can edit or delete this load.');
  });

  it('keeps Edit Load available in every lifecycle state', () => {
    expect(route).toContain('const editReason: string | null = null');
    expect(route).toContain('canEdit: !editReason');
    expect(route).not.toContain("if (!checked.context.capabilities.canEdit)");
    expect(page).toContain('ownerCapabilities?.canEdit');
    expect(editPage).toContain('at any lifecycle stage');
    expect(brokerEditPage).toContain('at any lifecycle stage');
    expect(adminEditPage).toContain('at any lifecycle stage');
    expect(brokerLoadsPage).toContain('`/broker/jobs/${job.id}/edit`');
    expect(brokerJobsPage).toContain('`/broker/jobs/${job.id}/edit`');
    expect(adminJobPage).toContain('`/admin/jobs/${encodeURIComponent(jobId)}/edit`');
  });

  it('does not reset lifecycle, award or exchange state while editing', () => {
    expect(route).toContain('status: originalJob.status');
    expect(route).toContain('current_status: originalJob.current_status');
    expect(route).toContain('exchange_visibility: originalJob.exchange_visibility');
    const patchBlock = route.slice(route.indexOf('export async function PATCH'), route.indexOf('export async function DELETE'));
    expect(patchBlock).not.toContain(".is('awarded_carrier_company_id', null).is('assigned_company_id', null).is('assigned_driver_id', null).is('vehicle_id', null)");
  });

  it('preserves progressed stop history while synchronising route fields', () => {
    expect(route).toContain("client.from('job_stops').update(desired)");
    expect(route).toContain('const progressedStops = originalStops.filter');
    expect(route).toContain('A progressed stop cannot be removed, reordered');
    expect(route).toContain('const progressed =');
    expect(route).toContain('if (progressed) continue');
    expect(editForm).toContain('Executed position locked');
  });

  it('guards concurrent corrections and records an auditable before/after correction', () => {
    expect(route).toContain(".eq('updated_at', originalUpdatedAt)");
    expect(route).toContain("client.from('owner_audit_log').insert");
    expect(route).toContain("source: 'workspace_owner_correction'");
    expect(route).toContain("action_type: 'job_details_corrected'");
    expect(route).toContain('lifecycle_preserved: true');
    expect(route).toContain('stops: originalStops');
    expect(route).toContain('requested_stops: desiredStops');
    expect(route).toContain('The load correction audit failed. Your previous details were restored.');
  });

  it('keeps delete safety independent from edit capability', () => {
    expect(route).toContain('preferredJobLifecycleStatus(job)');
    expect(route).toContain('hasOnlyPreExecutionJobStatuses(job)');
    expect(route).toContain('if (assigned) deleteReason');
    expect(route).toContain('Loads with carrier quote history cannot be deleted.');
    expect(route).toContain('This load already has protected commercial or execution history.');
    expect(route).toContain("client.rpc('delete_unbid_exchange_job_atomic'");
    expect(route).toContain('p_actor_user_id: auth.userId');
    const deleteBlock = route.slice(route.indexOf('export async function DELETE'));
    expect(deleteBlock).not.toContain("client.from('jobs').delete()");
    expect(page).toContain('ownerCapabilities?.canDelete');
    expect(page).toContain('Confirm Delete');
  });

  it('returns to the correct role-specific booking route after edit or cancel', () => {
    expect(editForm).toContain('const jobDetailsHref');
    expect(editForm).toContain("mode === 'broker'");
    expect(editForm).toContain('/broker/jobs?job=');
    expect(editForm).toContain("mode === 'admin'");
    expect(editForm).toContain('/admin/jobs/');
    expect(editForm).toContain('/customer/jobs/');
    expect(editForm).not.toContain('`/${mode}/jobs/${jobId}');
  });
  it('exposes the complete Edit Load form', () => {
    expect(editForm).toContain('Additional stops');
    expect(editForm).toContain('PostcodeAddressField');
    expect(editForm).toContain('const QUARTER_HOUR_SLOTS = Array.from({ length: 96 }');
    expect(editForm).not.toContain('HALF_HOUR_SLOTS');
    expect(editForm).toContain('Executed position locked');
    expect(editForm).toContain('Length (cm)');
    expect(editForm).toContain('Width (cm)');
    expect(editForm).toContain('Height (cm)');
    expect(editForm).toContain("method: 'PATCH'");
  });
});
