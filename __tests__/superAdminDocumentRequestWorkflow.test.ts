import fs from 'node:fs';
import path from 'node:path';

describe('Super Admin onboarding document request workflow', () => {
  const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

  test('request mutation derives missing documents server-side and audits the actor', () => {
    const migration = read('supabase/migrations/20260831235945_platform_document_completion_requests.sql');
    expect(migration).toContain('get_missing_onboarding_documents(p_application_id)');
    expect(migration).toContain('assert_platform_owner_actor(p_actor_user_id)');
    expect(migration).toContain('INSERT INTO public.owner_audit_log');
    expect(migration).toContain("'email_required', true");
    expect(migration).toContain("'onboarding_url', '/onboarding/resume'");
  });

  test('API does not accept a client supplied requested-document list', () => {
    const route = read('app/api/super-admin/onboarding/[applicationId]/request-documents/route.ts');
    expect(route).toContain('reason: z.string()');
    expect(route).toContain('reminder: z.boolean()');
    expect(route).not.toContain('requestedDocuments:');
    expect(route).toContain('Deploy Preview is read-only');
    expect(route).toContain("primaryChannel: 'email'");
  });

  test('document email enumerates canonical missing documents and deep-links to onboarding', () => {
    const worker = read('supabase/functions/notify-document-request/index.ts');
    expect(worker).toContain('event.payload.missing_documents');
    expect(worker).toContain('Complete your documents');
    expect(worker).toContain("'/onboarding/resume'");
    expect(worker).toContain('RESEND_API_KEY');
    expect(worker).toContain('Idempotency-Key');
  });

  test('all onboarding variants inherit the persistent document checklist', () => {
    const layout = read('app/onboarding/layout.tsx');
    const checklist = read('app/onboarding/_components/OnboardingDocumentChecklist.tsx');
    expect(layout).toContain('<OnboardingDocumentChecklist />');
    expect(checklist).toContain('/api/onboarding/missing-documents');
    expect(checklist).toContain('This reminder remains visible until the canonical requirements are complete.');
  });

  test('Super Admin verification exposes request and reminder controls', () => {
    const page = read('app/super-admin/companies/verification/page.tsx');
    expect(page).toContain('Request documents');
    expect(page).toContain('Send reminder');
    expect(page).toContain('Send request by email');
    expect(page).toContain('Preview — sending disabled');
  });
});
