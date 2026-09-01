import fs from 'node:fs';
import path from 'node:path';

describe('Super Admin onboarding document request workflow', () => {
  const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

  test('request mutation derives missing documents server-side and audits the actor', () => {
    const migration = read('supabase/migrations/20260831235945_platform_document_completion_requests.sql');
    expect(migration).toContain('get_missing_onboarding_documents(p_application_id)');
    expect(migration).toContain('assert_platform_owner_actor(p_actor_user_id)');
    expect(migration).toContain('INSERT INTO public.notification_events');
    expect(migration).toContain('INSERT INTO public.owner_audit_log');
    expect(migration).toContain("'email_required', true");
    expect(migration).toContain("'onboarding_url', '/onboarding/resume'");
  });

  test('API does not accept a client supplied requested-document list and Preview writes fail closed', () => {
    const route = read('app/api/super-admin/onboarding/[applicationId]/request-documents/route.ts');
    const verifier = read('app/api/super-admin/_lib/verifyPlatformOwner.ts');
    expect(route).toContain('reason: z.string()');
    expect(route).toContain('reminder: z.boolean()');
    expect(route).not.toContain('requestedDocuments:');
    expect(route).toContain('Deploy Preview is read-only');
    expect(route).toContain("primaryChannel: 'email'");
    expect(verifier).toContain("const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])");
    expect(verifier).toContain('isSuperAdminDeployPreviewReadOnly()');
  });

  test('only a genuinely outstanding request is exposed and its canonical queue delivery is linked', () => {
    const route = read('app/api/super-admin/onboarding/[applicationId]/request-documents/route.ts');
    expect(route).toContain(".eq('status', 'outstanding')");
    expect(route).toContain(".from('notification_events')");
    expect(route).toContain("'onboarding_documents_required'");
    expect(route).toContain("'onboarding_documents_reminder'");
    expect(route).toContain('row.payload?.document_request_id');
    expect(route).toContain('delivery,');
  });

  test('user-side missing-document GET cannot perform housekeeping writes in Deploy Preview', () => {
    const route = read('app/api/onboarding/missing-documents/route.ts');
    expect(route).toContain('isDeployPreviewReadOnly');
    expect(route).toContain('missingDocuments.length === 0 && !isDeployPreviewReadOnly()');
    expect(route).toContain("supabaseAdmin.rpc('resolve_completed_document_requests'");
  });

  test('user checklist exposes canonical document lifecycle states without returning document file paths', () => {
    const route = read('app/api/onboarding/missing-documents/route.ts');
    const checklist = read('app/onboarding/_components/OnboardingDocumentChecklist.tsx');
    expect(route).toContain("type ChecklistStatus = 'missing' | 'uploaded' | 'approved' | 'expiring_soon' | 'expired' | 'rejected'");
    expect(route).toContain(".from('compliance_document_requirements')");
    expect(route).toContain(".from('company_documents')");
    expect(route).toContain(".from('driver_identity_documents')");
    expect(route).toContain('documentDetailsAvailable');
    expect(checklist).toContain('Uploaded · pending review');
    expect(checklist).toContain('Expiring soon');
    expect(checklist).toContain('Rejected');
    expect(checklist).not.toContain('file_path');
  });

  test('document request closes automatically and audibly when canonical requirements become satisfied', () => {
    const migration = read('supabase/migrations/20260831235945_platform_document_completion_requests.sql');
    expect(migration).toContain('resolve_document_requests_after_compliance_change');
    expect(migration).toContain('trg_resolve_document_requests_company_documents');
    expect(migration).toContain('trg_resolve_document_requests_identity_documents');
    expect(migration).toContain("'onboarding_document_request_auto_resolved'");
    expect(migration).toContain("'canonical_requirements_satisfied'");
  });

  test('document delivery uses the canonical operational notification worker', () => {
    const worker = read('supabase/functions/notify-operational-event/index.ts');
    expect(worker).toContain("case 'onboarding_documents_required'");
    expect(worker).toContain("case 'onboarding_documents_reminder'");
    expect(worker).toContain('event.payload.missing_documents');
    expect(worker).toContain('Complete your documents');
    expect(worker).toContain("'/onboarding/resume'");
    expect(worker).toContain('notificationIdempotencyKey(event.id, userId)');
    expect(fs.existsSync(path.join(process.cwd(), 'supabase/functions/notify-document-request/index.ts'))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), 'supabase/migrations/20260831235946_document_request_notification_router.sql'))).toBe(false);
  });

  test('all onboarding variants inherit the persistent document checklist', () => {
    const layout = read('app/onboarding/layout.tsx');
    const checklist = read('app/onboarding/_components/OnboardingDocumentChecklist.tsx');
    expect(layout).toContain('<OnboardingDocumentChecklist />');
    expect(checklist).toContain('/api/onboarding/missing-documents');
    expect(checklist).toContain('This reminder remains visible until the canonical requirements are complete.');
  });

  test('Super Admin verification exposes request, delivery, and reminder controls', () => {
    const page = read('app/super-admin/companies/verification/page.tsx');
    expect(page).toContain('Request documents');
    expect(page).toContain('Send reminder');
    expect(page).toContain('Send request by email');
    expect(page).toContain('Preview — sending disabled');
    expect(page).toContain('Delivery:');
    expect(page).toContain("preflight.delivery?.status === 'failed'");
  });
});
