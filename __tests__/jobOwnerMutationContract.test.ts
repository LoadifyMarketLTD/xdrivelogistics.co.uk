import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const route = fs.readFileSync(path.join(root, 'app/api/workspace/jobs/[jobId]/owner/route.ts'), 'utf8');
const page = fs.readFileSync(path.join(root, 'app/customer/jobs/[id]/page.tsx'), 'utf8');
const editForm = fs.readFileSync(path.join(root, 'app/components/workspace/JobOwnerEditForm.tsx'), 'utf8');

describe('posting-company owner edit/delete contract', () => {
  it('authorises mutations server-side against the posting company membership', () => {
    expect(route).toContain(".eq('company_id', ownerCompanyId)");
    expect(route).toContain(".eq('user_id', userId)");
    expect(route).toContain(".in('role_in_company', ['owner', 'admin', 'dispatcher'])");
    expect(route).toContain('Only the posting company can edit or delete this load.');
  });

  it('locks edit/delete after commercial award or execution allocation', () => {
    expect(route).toContain('job.awarded_carrier_company_id || job.assigned_company_id || job.assigned_driver_id || job.vehicle_id');
    expect(route).toContain(".is('awarded_carrier_company_id', null).is('assigned_company_id', null).is('assigned_driver_id', null).is('vehicle_id', null)");
    expect(route).toContain("['draft', 'received', 'posted'].includes(status)");
  });

  it('does not silently mutate a posted load after carrier quotes exist', () => {
    expect(route).toContain("countRows(client, 'job_bids', 'job_id', jobId)");
    expect(route).toContain('Carrier quotes already exist for this load. Changing the transport terms would make those quotes stale.');
  });

  it('protects audit-bearing jobs from deletion', () => {
    for (const table of ['proof_of_delivery', 'invoices', 'job_documents', 'documents', 'job_disputes', 'job_cancellation_requests', 'invoice_disputes', 'reviews']) {
      expect(route).toContain(`'${table}'`);
    }
    expect(route).toContain('This load has stored documents. Remove or archive the load instead of deleting its audit evidence.');
  });

  it('stages edits private before replacing multi-drop stops and restores on failure', () => {
    expect(route).toContain("status: 'draft'");
    expect(route).toContain("exchange_visibility: 'private'");
    expect(route).toContain("client.from('job_stops').delete().eq('job_id', jobId)");
    expect(route).toContain('const rollback = async () =>');
    expect(route).toContain("input.publish ? 'exchange' : 'private'");
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
