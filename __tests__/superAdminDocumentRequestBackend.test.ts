import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');
const MIGRATION = 'supabase/migrations/20260831235945_platform_document_completion_requests.sql';

describe('Super Admin document request backend foundation', () => {
  it('derives requested documents server-side and queues the canonical notification event', () => {
    const migration = readRepoFile(MIGRATION);
    expect(migration).toContain('get_missing_onboarding_documents(p_application_id)');
    expect(migration).toContain('assert_platform_owner_actor(p_actor_user_id)');
    expect(migration).toContain('INSERT INTO public.notification_events');
    expect(migration).toContain("'onboarding_documents_required'");
    expect(migration).toContain("'onboarding_documents_reminder'");
    expect(migration).toContain("'onboarding_url', '/onboarding/resume'");
    expect(migration).toContain("'email_required', true");
    expect(migration).toContain('INSERT INTO public.owner_audit_log');
  });

  it('keeps the registry and workflow RPC service-role only', () => {
    const migration = readRepoFile(MIGRATION);
    expect(migration).toContain('ALTER TABLE public.platform_document_requests ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('REVOKE ALL ON TABLE public.platform_document_requests FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('GRANT SELECT, INSERT, UPDATE ON TABLE public.platform_document_requests TO service_role');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.owner_request_onboarding_documents(uuid, uuid, text, boolean) FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.owner_request_onboarding_documents(uuid, uuid, text, boolean) TO service_role');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.resolve_completed_document_requests(uuid) FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.resolve_completed_document_requests(uuid) TO service_role');
  });

  it('normalizes nullable onboarding status before the NOT NULL owner audit write', () => {
    const migration = readRepoFile(MIGRATION);
    expect(migration).toContain("v_application_status := COALESCE(NULLIF(trim(v_application.status::text), ''), 'unknown');");
    expect(migration).toContain('v_application_status, v_application_status,');
    expect(migration).not.toContain('v_application.status::text, v_application.status::text,');
  });

  it('does not trust a client-supplied document list and inherits Preview write fail-closed authority', () => {
    const route = readRepoFile('app/api/super-admin/onboarding/[applicationId]/request-documents/route.ts');
    const verifier = readRepoFile('app/api/super-admin/_lib/verifyPlatformOwner.ts');
    expect(route).toContain('reason: z.string()');
    expect(route).toContain('reminder: z.boolean()');
    expect(route).not.toContain('requestedDocuments:');
    expect(route).toContain("supabaseAdmin.rpc('get_missing_onboarding_documents'");
    expect(route).toContain("supabaseAdmin.rpc('owner_request_onboarding_documents'");
    expect(route).toContain('Deploy Preview is read-only');
    expect(verifier).toContain("const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])");
    expect(verifier).toContain('isSuperAdminDeployPreviewReadOnly()');
  });

  it('delivers document requests through the existing operational notification worker', () => {
    const worker = readRepoFile('supabase/functions/notify-operational-event/index.ts');
    expect(worker).toContain('handleOnboardingDocumentsRequired');
    expect(worker).toContain("case 'onboarding_documents_required'");
    expect(worker).toContain("case 'onboarding_documents_reminder'");
    expect(worker).toContain('event.payload.missing_documents');
    expect(worker).toContain('notificationIdempotencyKey(event.id, userId)');
    expect(worker).toContain('Complete your documents');
    expect(worker).not.toContain('notify-document-request');
  });
});
