import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');
const MIGRATION = 'supabase/migrations/20260902091000_platform_notification_retry_governance.sql';
const PLATFORM_ROUTE = 'app/api/super-admin/platform/route.ts';
const PAGE = 'app/super-admin/notifications/page.tsx';

describe('Platform Owner notification retry governance', () => {
  it('requeues only failed or skipped events and clears stale leases', () => {
    const migration = readRepoFile(MIGRATION);
    expect(migration).toContain("NOT IN ('failed', 'skipped')");
    expect(migration).toContain("status = 'pending'");
    expect(migration).toContain('processed_at = NULL');
    expect(migration).toContain('last_error = NULL');
    expect(migration).toContain('next_attempt_at = v_next_attempt_at');
    expect(migration).toContain('lease_token = NULL');
    expect(migration).toContain('lease_expires_at = NULL');
  });

  it('preserves attempt history instead of resetting delivery counters', () => {
    const migration = readRepoFile(MIGRATION);
    expect(migration).not.toContain('attempt_count = 0');
    expect(migration).not.toContain('last_attempt_at = NULL');
    expect(migration).toContain("'attempt_count_before_retry', v_event.attempt_count");
    expect(migration).toContain("'last_attempt_at_before_retry', v_event.last_attempt_at");
  });

  it('requires active Platform Owner authority, reason and atomic audit', () => {
    const migration = readRepoFile(MIGRATION);
    expect(migration).toContain('PERFORM public.assert_platform_owner_actor(p_actor_user_id)');
    expect(migration).toContain('A notification retry reason of at least 5 characters is required.');
    expect(migration).toContain('INSERT INTO public.owner_audit_log');
    expect(migration).toContain("'notification_retry_queued'");
    expect(migration).toContain('FOR UPDATE');
  });

  it('keeps the retry RPC service-role only', () => {
    const migration = readRepoFile(MIGRATION);
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path = pg_catalog, public');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.owner_retry_notification_event(uuid, uuid, text) FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.owner_retry_notification_event(uuid, uuid, text) TO service_role');
  });

  it('removes the old direct queue update and fail-closes deploy preview writes', () => {
    const route = readRepoFile(PLATFORM_ROUTE);
    const patch = route.slice(route.indexOf('export async function PATCH'));
    expect(patch).toContain('verifyPlatformOwner(request)');
    expect(patch).toContain('isSuperAdminDeployPreviewReadOnly()');
    expect(patch).toContain("supabaseAdmin.rpc('owner_retry_notification_event'");
    expect(patch).not.toContain(".from('notification_events')");
    expect(patch).not.toContain('.update({');
    expect(patch).not.toContain('fallbackError');
  });

  it('requires an explicit reason in the Notification Centre before queueing', () => {
    const page = readRepoFile(PAGE);
    expect(page).toContain('Retry notification');
    expect(page).toContain('retryReason.trim().length < 5');
    expect(page).toContain('your reason is written to the Platform Owner audit log');
    expect(page).toContain('Queue retry');
  });
});
