import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

const MIGRATION = 'supabase/migrations/20260902084500_platform_pod_review.sql';
const ROUTE = 'app/api/super-admin/pod/[jobId]/route.ts';
const PAGE = 'app/super-admin/operations/pods/[jobId]/page.tsx';
const LIST_PAGE = 'app/super-admin/operations/pods/page.tsx';

describe('Platform Owner POD review lane', () => {
  it('isolates Platform Owner POD provenance from tenant-visible jobs columns', () => {
    const migration = readRepoFile(MIGRATION);

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.platform_pod_reviews');
    expect(migration).toContain('job_id uuid PRIMARY KEY REFERENCES public.jobs(id) ON DELETE CASCADE');
    expect(migration).not.toContain('ADD COLUMN IF NOT EXISTS platform_pod_review_status');
    expect(migration).not.toContain('SET broker_pod_review_status');
  });

  it('keeps reviewer provenance durable without blocking auth account lifecycle', () => {
    const migration = readRepoFile(MIGRATION);

    expect(migration).toContain('reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL');
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_platform_pod_reviews_reviewed_by');
    expect(migration).toContain('ON public.platform_pod_reviews(reviewed_by)');
    expect(migration).not.toContain('reviewed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT');
  });

  it('keeps the registry and semantic mutation service-role only', () => {
    const migration = readRepoFile(MIGRATION);

    expect(migration).toContain('ALTER TABLE public.platform_pod_reviews ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('REVOKE ALL ON TABLE public.platform_pod_reviews FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('GRANT SELECT, INSERT, UPDATE ON TABLE public.platform_pod_reviews TO service_role');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.owner_review_job_pod(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.owner_review_job_pod(uuid, uuid, text, text) TO service_role');
  });

  it('requires Platform Owner authority, reason and physical evidence before approval', () => {
    const migration = readRepoFile(MIGRATION);

    expect(migration).toContain('PERFORM public.assert_platform_owner_actor(p_actor_user_id)');
    expect(migration).toContain('A review reason of at least 5 characters is required.');
    expect(migration).toContain("IF v_action = 'approve' AND NOT v_has_physical_evidence THEN");
    expect(migration).toContain('Cannot approve POD without physical delivery evidence.');
  });

  it('records durable owner audit without impersonating broker review', () => {
    const migration = readRepoFile(MIGRATION);

    expect(migration).toContain('INSERT INTO public.owner_audit_log');
    expect(migration).toContain("'platform_pod_' || v_action");
    expect(migration).toContain("'authority', 'platform_owner'");
    expect(migration).toContain("'review_registry', 'platform_pod_reviews'");
    expect(migration).not.toContain('broker_pod_reviewed_by =');
  });

  it('uses owner-gated GET/PATCH API and never updates jobs directly', () => {
    const route = readRepoFile(ROUTE);

    expect(route).toContain('verifyPlatformOwner(request)');
    expect(route).toContain("z.enum(['approve', 'reject', 'request_missing'])");
    expect(route).toContain("supabaseAdmin.rpc('owner_review_job_pod'");
    expect(route).toContain(".from('platform_pod_reviews')");
    expect(route).not.toContain(".from('jobs').update(");
    expect(route).toContain('Deploy Preview is read-only. Platform POD review was not changed.');
  });

  it('keeps the existing generic entity inspector read-only', () => {
    const inspector = readRepoFile('app/super-admin/inspect/[entityType]/[entityId]/page.tsx');

    expect(inspector).toContain('READ ONLY');
    expect(inspector).not.toContain('/actions');
    expect(inspector).not.toContain("method: 'PATCH'");
  });

  it('exposes POD review through a dedicated Operations surface', () => {
    const page = readRepoFile(PAGE);
    const list = readRepoFile(LIST_PAGE);

    expect(page).toContain('/api/super-admin/pod/${encodeURIComponent(jobId)}');
    expect(page).toContain("method: 'PATCH'");
    expect(page).toContain('Platform Owner decision');
    expect(page).toContain('broker POD review provenance');
    expect(list).toContain('/super-admin/operations/pods/${encodeURIComponent(row.id)}');
    expect(list).toContain('Review POD →');
  });
});
