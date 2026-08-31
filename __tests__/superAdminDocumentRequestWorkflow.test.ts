import fs from 'node:fs';
import path from 'node:path';

describe('Super Admin onboarding document request workflow', () => {
  const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

  test('semantic mutation derives canonical requirements and audits Platform Owner action', () => {
    const migration = read('supabase/migrations/20260831235945_platform_document_completion_requests.sql');
    expect(migration).toContain('get_missing_onboarding_documents(p_application_id)');
    expect(migration).toContain('assert_platform_owner_actor(p_actor_user_id)');
    expect(migration).toContain('INSERT INTO public.notification_events');
    expect(migration).toContain('INSERT INTO public.owner_audit_log');
    expect(migration).toContain("'onboarding_documents_reminder'");
    expect(migration).toContain("'onboarding_documents_required'");
  });

  test('API accepts reason/reminder only and queues the semantic RPC', () => {
    const route = read('app/api/super-admin/onboarding/[applicationId]/request-documents/route.ts');
    expect(route).toContain('reason: z.string()');
    expect(route).toContain('reminder: z.boolean()');
    expect(route).not.toContain('requestedDocuments:');
    expect(route).toContain("supabaseAdmin.rpc('owner_request_onboarding_documents'");
    expect(route).toContain("notificationQueue: 'notification_events'");
  });

  test('canonical operational worker delivers document events without a parallel worker', () => {
    const worker = read('supabase/functions/notify-operational-event/index.ts');
    expect(worker).toContain("case 'onboarding_documents_required'");
    expect(worker).toContain("case 'onboarding_documents_reminder'");
    expect(worker).toContain('event.payload.missing_documents');
    expect(worker).toContain('Complete your documents');
    expect(worker).toContain('notificationIdempotencyKey(event.id, userId)');
    expect(fs.existsSync(path.join(process.cwd(), 'supabase/functions/notify-document-request/index.ts'))).toBe(false);
  });
});
