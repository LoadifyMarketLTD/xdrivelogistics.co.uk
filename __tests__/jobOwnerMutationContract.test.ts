import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const route = fs.readFileSync(path.join(root, 'app/api/workspace/jobs/[jobId]/owner/route.ts'), 'utf8');
const page = fs.readFileSync(path.join(root, 'app/customer/jobs/[id]/page.tsx'), 'utf8');
const editPage = fs.readFileSync(path.join(root, 'app/customer/jobs/[id]/edit/page.tsx'), 'utf8');
const retireEditMigration = fs.readFileSync(path.join(root, 'supabase/migrations/20260830125607_retire_owner_job_edit_rpc.sql'), 'utf8');

describe('posting-company owner mutation contract', () => {
  it('authorises load management against posting-company membership', () => {
    expect(route).toContain(".eq('company_id', ownerCompanyId)");
    expect(route).toContain(".eq('user_id', userId)");
    expect(route).toContain(".in('role_in_company', ['owner', 'admin', 'dispatcher'])");
    expect(route).toContain('Only the posting company can manage this load.');
  });

  it('locks posted-load editing and directs changes to Driver messages', () => {
    expect(route).toContain('canEdit: false');
    expect(route).toContain('Posted load details are locked. Send a Driver message for any change or new instruction.');
    expect(route).toContain('export async function PATCH()');
    expect(route).toContain('return respond(405');
    expect(route).not.toContain("client.rpc('update_unbid_exchange_job_atomic'");
    expect(editPage).toContain('Load details are locked after posting');
    expect(editPage).toContain('Messages / changes for Driver');
  });

  it('retires the temporary owner-edit RPC from the hosted schema', () => {
    expect(retireEditMigration).toContain('DROP FUNCTION IF EXISTS public.update_unbid_exchange_job_atomic');
  });

  it('fails closed on divergent lifecycle fields for deletion', () => {
    expect(route).toContain('preferredJobLifecycleStatus(job)');
    expect(route).toContain('hasOnlyPreExecutionJobStatuses(job)');
    expect(route).not.toContain("const status = String(job.current_status ?? job.status ?? '').toLowerCase()");
  });

  it('protects loads with quotes or execution history from deletion', () => {
    expect(route).toContain("countRows(client, 'job_bids', 'job_id', jobId)");
    for (const table of ['proof_of_delivery', 'invoices', 'job_documents', 'documents', 'job_disputes', 'job_cancellation_requests', 'invoice_disputes', 'reviews']) {
      expect(route).toContain(`'${table}'`);
    }
    expect(route).toContain('Loads with carrier quote history cannot be deleted.');
    expect(route).toContain('This load already has protected commercial or execution history.');
  });

  it('uses the atomic delete guard so a concurrent bid cannot be cascaded away', () => {
    expect(route).toContain("client.rpc('delete_unbid_exchange_job_atomic'");
    expect(route).toContain('p_actor_user_id: auth.userId');
    expect(route).not.toMatch(/client\.from\('jobs'\)\.delete\(\)/);
  });

  it('keeps confirmed Delete Load control separate from editing', () => {
    expect(page).toContain('ownerCapabilities?.canDelete');
    expect(page).toContain('Confirm Delete');
    expect(page).toContain("method: 'DELETE'");
    expect(page).toContain('ownerCapabilities?.canEdit');
  });
});
