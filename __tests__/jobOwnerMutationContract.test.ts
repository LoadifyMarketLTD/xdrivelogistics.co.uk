import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const route = fs.readFileSync(path.join(root, 'app/api/workspace/jobs/[jobId]/owner/route.ts'), 'utf8');
const page = fs.readFileSync(path.join(root, 'app/customer/jobs/[id]/page.tsx'), 'utf8');
const editForm = fs.readFileSync(path.join(root, 'app/components/workspace/JobOwnerEditForm.tsx'), 'utf8');
const atomicEditMigration = fs.readFileSync(path.join(root, 'supabase/migrations/20260830124705_add_atomic_owner_job_edit_guard.sql'), 'utf8');

describe('posting-company owner edit/delete contract', () => {
  it('authorises mutations server-side against the posting company membership', () => {
    expect(route).toContain(".eq('company_id', ownerCompanyId)");
    expect(route).toContain(".eq('user_id', userId)");
    expect(route).toContain(".in('role_in_company', ['owner', 'admin', 'dispatcher'])");
    expect(route).toContain('Only the posting company can edit or delete this load.');
  });

  it('locks edit/delete after commercial award or execution allocation', () => {
    expect(route).toContain('job.awarded_carrier_company_id || job.assigned_company_id || job.assigned_driver_id || job.vehicle_id');
    expect(route).toContain('hasOnlyPreExecutionJobStatuses(job)');
    expect(atomicEditMigration).toContain('v_job.awarded_carrier_company_id IS NOT NULL');
    expect(atomicEditMigration).toContain('v_job.assigned_company_id IS NOT NULL');
    expect(atomicEditMigration).toContain('v_job.assigned_driver_id IS NOT NULL');
    expect(atomicEditMigration).toContain('v_job.vehicle_id IS NOT NULL');
  });

  it('fails closed on divergent lifecycle status fields', () => {
    expect(route).toContain('preferredJobLifecycleStatus(job)');
    expect(route).toContain('hasOnlyPreExecutionJobStatuses(job)');
    expect(route).not.toContain("const status = String(job.current_status ?? job.status ?? '').toLowerCase()");
    expect(atomicEditMigration).toContain("v_status NOT IN ('draft', 'received', 'posted')");
    expect(atomicEditMigration).toContain("v_current_status NOT IN ('draft', 'received', 'posted')");
  });

  it('does not silently mutate a posted load after carrier quotes exist', () => {
    expect(route).toContain("countRows(client, 'job_bids', 'job_id', jobId)");
    expect(route).toContain('Carrier quotes already exist for this load. Changing the transport terms would make those quotes stale.');
    expect(atomicEditMigration).toContain('EXISTS (SELECT 1 FROM public.job_bids WHERE job_id = p_job_id)');
  });

  it('protects audit-bearing jobs from deletion', () => {
    for (const table of ['proof_of_delivery', 'invoices', 'job_documents', 'documents', 'job_disputes', 'job_cancellation_requests', 'invoice_disputes', 'reviews']) {
      expect(route).toContain(`'${table}'`);
    }
    expect(route).toContain('This load has stored documents. Remove or archive the load instead of deleting its audit evidence.');
  });

  it('uses the server-only atomic delete guard so a concurrent bid cannot be cascaded away', () => {
    expect(route).toContain("client.rpc('delete_unbid_exchange_job_atomic'");
    expect(route).toContain('p_actor_user_id: auth.userId');
    expect(route).not.toMatch(/client\.from\('jobs'\)\.delete\(\)/);
  });

  it('edits already-posted loads through one atomic RPC without an illegal posted-to-draft stage', () => {
    expect(route).toContain("client.rpc('update_unbid_exchange_job_atomic'");
    expect(route).toContain('p_patch: patch');
    expect(route).toContain('p_stops: stopRows');
    expect(route).not.toContain("status: 'draft'");
    expect(route).not.toContain("client.from('job_stops').delete().eq('job_id', jobId)");
    expect(atomicEditMigration).toContain('FOR UPDATE');
    expect(atomicEditMigration).toContain("v_final_status := 'posted'");
    expect(atomicEditMigration).toContain('DELETE FROM public.job_stops');
    expect(atomicEditMigration).toContain('exchange_load_edited_without_bids');
  });

  it('keeps the edit RPC server-only', () => {
    expect(atomicEditMigration).toContain('SECURITY DEFINER');
    expect(atomicEditMigration).toContain('REVOKE ALL ON FUNCTION public.update_unbid_exchange_job_atomic');
    expect(atomicEditMigration).toContain('FROM authenticated');
    expect(atomicEditMigration).toContain('GRANT EXECUTE ON FUNCTION public.update_unbid_exchange_job_atomic');
    expect(atomicEditMigration).toContain('TO service_role');
  });

  it('exposes explicit customer Edit Load and confirmed Delete Load controls', () => {
    expect(page).toContain('ownerCapabilities?.canEdit');
    expect(page).toContain('Edit Load');
    expect(page).toContain('ownerCapabilities?.canDelete');
    expect(page).toContain('Confirm Delete');
    expect(page).toContain("method: 'DELETE'");
  });

  it('edits the full unawarded booking contract, including multi-drop and cm dimensions', () => {
    expect(editForm).toContain('Additional stops');
    expect(editForm).toContain('PostcodeAddressField');
    expect(editForm).toContain('Length (cm)');
    expect(editForm).toContain('Width (cm)');
    expect(editForm).toContain('Height (cm)');
    expect(editForm).toContain("method: 'PATCH'");
  });
});
