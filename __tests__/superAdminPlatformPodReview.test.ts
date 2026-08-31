import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('SA-08 Platform Owner POD review lane', () => {
  it('keeps Platform Owner POD provenance separate from broker review provenance', () => {
    const migration = readRepoFile('supabase/migrations/20260831013000_platform_pod_review.sql');

    expect(migration).toContain('platform_pod_review_status');
    expect(migration).toContain('platform_pod_review_note');
    expect(migration).toContain('platform_pod_reviewed_by');
    expect(migration).toContain('platform_pod_reviewed_at');
    expect(migration).not.toContain('SET broker_pod_review_status');
  });

  it('requires active Platform Owner authority and records a durable owner audit row', () => {
    const migration = readRepoFile('supabase/migrations/20260831013000_platform_pod_review.sql');

    expect(migration).toContain('PERFORM public.assert_platform_owner_actor(p_actor_user_id)');
    expect(migration).toContain("INSERT INTO public.owner_audit_log");
    expect(migration).toContain("'authority', 'platform_owner'");
    expect(migration).toContain("'platform_pod_' || v_action");
    expect(migration).toContain('target_id');
    expect(migration).toContain('target_company_id');
  });

  it('does not allow POD approval without physical evidence', () => {
    const migration = readRepoFile('supabase/migrations/20260831013000_platform_pod_review.sql');

    expect(migration).toContain('v_has_physical_evidence');
    expect(migration).toContain("IF v_action = 'approve' AND NOT v_has_physical_evidence THEN");
    expect(migration).toContain('Cannot approve POD without physical delivery evidence.');
  });

  it('exposes only semantic review actions through an owner-gated API', () => {
    const route = readRepoFile('app/api/super-admin/pod/[jobId]/route.ts');

    expect(route).toContain('verifyPlatformOwner(request)');
    expect(route).toContain("z.enum(['approve', 'reject', 'request_missing'])");
    expect(route).toContain("supabaseAdmin.rpc('owner_review_job_pod'");
    expect(route).not.toContain(".from('jobs').update(");
  });

  it('suppresses POD controls when the branch-only migration is unavailable', () => {
    const actionsRoute = readRepoFile('app/api/super-admin/inspect/[entityType]/[entityId]/actions/route.ts');

    expect(actionsRoute).toContain('POD_REVIEW_SCHEMA_UNAVAILABLE_CODES');
    expect(actionsRoute).toContain('Platform POD review schema is not applied in this environment. POD review actions are suppressed.');
    expect(actionsRoute).toContain("id: 'pod_approve'");
    expect(actionsRoute).toContain("id: 'pod_reject'");
    expect(actionsRoute).toContain("id: 'pod_request_missing'");
  });

  it('executes POD actions from PlatformEntityInspector and reloads authoritative state', () => {
    const page = readRepoFile('app/super-admin/inspect/[entityType]/[entityId]/page.tsx');

    expect(page).toContain("entityTypeParam === 'pod'");
    expect(page).toContain('/api/super-admin/pod/${encodeURIComponent(entityIdParam)}');
    expect(page).toContain("descriptor.id === 'pod_approve' ? 'approve'");
    expect(page).toContain('await load();');
    expect(page).toContain('PodReviewSummary');
  });
});
