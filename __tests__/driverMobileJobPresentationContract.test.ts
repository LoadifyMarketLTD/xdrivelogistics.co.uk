import fs from 'node:fs';
import path from 'node:path';

describe('Driver mobile authorised job presentation', () => {
  const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
  const attachments = read('app/api/driver/mobile/jobAttachmentPresentation.ts');
  const operational = read('app/api/driver/mobile/jobOperationalPresentation.ts');
  const audit = read('app/api/driver/mobile/jobAuditPresentation.ts');
  const listRoute = read('app/api/driver/mobile/jobs/route.ts');
  const detailRoute = read('app/api/driver/mobile/jobs/[id]/route.ts');
  const storageMigration = read('supabase/migrations/101_customer_load_posting_completion.sql');
  const lifecycleMigration = read('supabase/migrations/20260827052500_preserve_driver_pod_signature_json.sql');
  const mobileTypes = read('apps/driver-mobile/src/jobs/types.ts');

  it('keeps load documents private and validates owner company plus job before service-role signing', () => {
    expect(storageMigration).toContain("'load-documents'");
    expect(storageMigration).toContain('d.user_id = auth.uid()');
    expect(attachments).toContain('segments[0] === job.company_id');
    expect(attachments).toContain('segments[1] === job.id');
    expect(attachments).toContain(".from('load-documents')");
    expect(attachments).toContain('.createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)');
    expect(attachments).not.toContain('getPublicUrl');
    expect(attachments).not.toContain('file_path: path');
  });

  it('queries attachments only for the assignment-gated job ids supplied by the outer route', () => {
    expect(attachments).toContain('const allowedJobs = new Map(rows.map((row) => [row.id, row]))');
    expect(attachments).toContain(".from('job_documents')");
    expect(attachments).toContain(".in('job_id', jobIds)");
    expect(listRoute).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(detailRoute).toContain(".eq('assigned_driver_id', driver.driverId)");
  });

  it('maps existing canonical job fields into the Expo detail model', () => {
    expect(operational).toContain("'pallets'");
    expect(operational).toContain("'weight_kg'");
    expect(operational).toContain("'job_distance_minutes'");
    expect(operational).toContain("'customer_reference'");
    expect(operational).toContain('client: text(row.client_name)');
    expect(operational).toContain('distance: distance ?');
    expect(operational).toContain('eta: durationMinutes ?');
    expect(operational).toContain('palletCount: palletCount ?');
    expect(operational).toContain('customerNotes: text(row.load_details)');
    expect(operational).toContain('specialInstructions: text(row.special_requirements)');
    expect(operational).toContain('customerReference: text(row.customer_reference)');
    expect(operational).toContain("type: 'collection'");
    expect(operational).toContain("type: 'delivery'");
  });

  it('derives the status audit only from canonical persisted history and real POD timestamps', () => {
    expect(lifecycleMigration).toContain("'source', 'driver_atomic_rpc'");
    expect(lifecycleMigration).toContain("'actor_user_id', v_actor");
    expect(audit).toContain('historyRows(row.status_history)');
    expect(audit).toContain("if (status === 'on_my_way' || status === 'on_my_way_pickup') return 'on_my_way_pickup'");
    expect(audit).toContain("if (status === 'on_site_pickup' || status === 'arrived_pickup') return 'arrived_pickup'");
    expect(audit).toContain("if (['in_transit', 'on_my_way_delivery', 'on_my_way_to_delivery', 'on_route_delivery'].includes(status)) return 'on_my_way_delivery'");
    expect(audit).toContain("if (status === 'invoiced' || status === 'invoice_generated') return 'invoice_generated'");
    expect(audit).toContain('const podTimestamp = validTimestamp(row.pod_generated_at)');
    expect(audit).toContain("status: 'pod_completed'");
    expect(operational).toContain('auditTrail: buildJobAuditTrail(row)');
  });

  it('attaches the same enriched presentation to list and detail responses', () => {
    expect(listRoute).toContain('...buildJobOperationalPresentation(row)');
    expect(listRoute).toContain('attachments: attachments.get(row.id) ?? []');
    expect(detailRoute).toContain('...buildJobOperationalPresentation(row)');
    expect(detailRoute).toContain('attachments,');
    expect(listRoute).toContain('attachmentPresentationPartial');
    expect(detailRoute).toContain('attachmentPresentationPartial');
  });

  it('models every file type accepted by the private load-documents bucket', () => {
    expect(mobileTypes).toContain("| 'webp'");
    expect(mobileTypes).toContain("| 'csv'");
    expect(mobileTypes).toContain("| 'doc'");
    expect(mobileTypes).toContain("| 'xls'");
    expect(mobileTypes).toContain("| 'other'");
  });
});
