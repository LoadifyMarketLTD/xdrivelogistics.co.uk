import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const pathRepair = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260830184500_repair_storage_object_path_rls.sql'),
  'utf8',
);
const reviewerRepair = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260830184530_repair_onboarding_storage_reviewer_rls.sql'),
  'utf8',
);
const invoiceRepair = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260830184540_repair_invoice_storage_member_rls_dependency.sql'),
  'utf8',
);
const runtimeProof = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260830184600_verify_storage_object_path_rls_runtime.sql'),
  'utf8',
);
const mobileEvidenceRoute = fs.readFileSync(
  path.join(process.cwd(), 'app/api/driver/mobile/jobs/[id]/evidence/route.ts'),
  'utf8',
);

describe('Storage object-path RLS repair', () => {
  it('qualifies the outer storage.objects.name inside correlated policy subqueries', () => {
    expect(pathRepair).toContain('storage.foldername(storage.objects.name)');
    expect(pathRepair).not.toContain('storage.foldername(d.name)');
  });

  it('repairs load, POD and vehicle policy families', () => {
    for (const policy of [
      'load_documents_select_creator_operator_or_driver',
      'vehicle_docs_insert_assigned_driver',
      'vehicle_docs_select_assigned_driver',
      'pod_photos_insert_driver',
      'pod_photos_insert_operator_for_accessible_job',
      'pod_photos_select_driver',
      'pod_photos_select_job_owner_awarded_carrier_or_driver',
    ]) {
      expect(pathRepair).toContain(policy);
    }
  });

  it('tightens direct Driver POD insert access to the exact assigned job', () => {
    expect(pathRepair).toContain('JOIN public.drivers d ON d.id = j.assigned_driver_id');
    expect(pathRepair).toContain('j.id::text = (storage.foldername(storage.objects.name))[2]');
    expect(pathRepair).toContain('d.user_id = auth.uid()');
    expect(pathRepair).toContain('d.app_access = true');
  });

  it('matches the current mobile POD company/job/category path contract', () => {
    expect(mobileEvidenceRoute).toContain('`${driver.companyId}/${id}/${category}/${objectName}`');
    expect(pathRepair).toContain("pod-photos/{carrier_company_id}/{job_id}/{category}/{filename}");
  });

  it('does not solve restricted-table policy dependencies by granting raw evidence access', () => {
    expect(reviewerRepair).toContain('can_review_onboarding_storage_object');
    expect(reviewerRepair).toContain(
      'REVOKE ALL ON TABLE public.driver_identity_documents FROM PUBLIC, anon, authenticated',
    );
    expect(reviewerRepair).toContain(
      'REVOKE ALL ON TABLE public.company_documents FROM PUBLIC, anon, authenticated',
    );
    expect(reviewerRepair).toContain('GRANT ALL ON TABLE public.driver_identity_documents TO service_role');
    expect(reviewerRepair).toContain('GRANT ALL ON TABLE public.company_documents TO service_role');
    expect(reviewerRepair).toContain("has_table_privilege('authenticated', 'public.driver_identity_documents', 'SELECT')");
    expect(reviewerRepair).toContain("has_table_privilege('authenticated', 'public.company_documents', 'SELECT')");
    expect(reviewerRepair).toContain("has_table_privilege('anon', 'public.driver_identity_documents', 'SELECT')");
    expect(reviewerRepair).toContain("has_table_privilege('anon', 'public.company_documents', 'SELECT')");
    expect(invoiceRepair).toContain('can_read_invoice_storage_object');
    expect(invoiceRepair).toContain(
      'REVOKE ALL ON TABLE public.invoice_documents FROM PUBLIC, anon, authenticated',
    );
    expect(invoiceRepair).toContain('GRANT ALL ON TABLE public.invoice_documents TO service_role');
    expect(invoiceRepair).toContain("has_table_privilege('authenticated', 'public.invoice_documents', 'SELECT')");
    expect(invoiceRepair).toContain("has_table_privilege('anon', 'public.invoice_documents', 'SELECT')");
    expect(invoiceRepair).toContain("has_table_privilege('service_role', 'public.invoice_documents', 'SELECT')");
  });

  it('proves real authenticated RLS visibility for an assigned Driver and denial for an outsider', () => {
    expect(runtimeProof).toContain('SET LOCAL ROLE authenticated');
    expect(runtimeProof).toContain('request.jwt.claim.sub');
    expect(runtimeProof).toContain('Assigned Driver could not read their canonical vehicle document through RLS');
    expect(runtimeProof).toContain('Unrelated Customer could read another company vehicle document through RLS');
  });

  it('contains a durable zero-tolerance postcondition for Driver-name path parsing', () => {
    expect(pathRepair).toContain('Storage RLS still contains % Driver-name path parser(s).');
    expect(runtimeProof).toContain('Driver-name Storage path parser reappeared during runtime proof.');
  });
});
