import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');
const MIGRATION = 'supabase/migrations/20260930104500_exception_closure_engine_phase1.sql';

describe('Exception & Closure Engine Phase 1', () => {
  it('persists SLA, escalation and next-action obligations', () => {
    const migration = readRepoFile(MIGRATION);
    for (const field of [
      'sla_due_at',
      'sla_breached_at',
      'escalated_at',
      'escalation_level',
      'next_action',
      'next_action_due_at',
      'customer_update_due_at',
      'closure_due_at',
    ]) expect(migration).toContain(field);
  });

  it('defines deterministic severity SLA defaults', () => {
    const migration = readRepoFile(MIGRATION);
    expect(migration).toContain("WHEN 'P0' THEN interval '15 minutes'");
    expect(migration).toContain("WHEN 'P1' THEN interval '30 minutes'");
    expect(migration).toContain("WHEN 'P2' THEN interval '2 hours'");
    expect(migration).toContain("ELSE interval '8 hours'");
    expect(migration).toContain('trg_platform_cases_sla_defaults');
  });

  it('persists first breach and semantic escalation event', () => {
    const migration = readRepoFile(MIGRATION);
    expect(migration).toContain('service_reconcile_platform_case_sla');
    expect(migration).toContain("event_type, old_status, new_status, reason, metadata");
    expect(migration).toContain("'sla_breached'");
    expect(migration).toContain('b.created_by_user_id');
    expect(migration).not.toContain('ALTER COLUMN actor_user_id DROP NOT NULL');
    expect(migration).toContain("sla_breached_at = COALESCE(pc.sla_breached_at, p_now)");
    expect(migration).toContain("escalated_at = COALESCE(pc.escalated_at, p_now)");
  });

  it('keeps SLA reconciliation service-controlled', () => {
    const migration = readRepoFile(MIGRATION);
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.service_reconcile_platform_case_sla(timestamptz) FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.service_reconcile_platform_case_sla(timestamptz) TO service_role');
  });

  it('exposes SLA state in API and Action Centre', () => {
    const api = readRepoFile('app/api/super-admin/cases/route.ts');
    const page = readRepoFile('app/super-admin/action-centre/page.tsx');
    expect(api).toContain('sla_due_at');
    expect(api).toContain('sla_breached_at');
    expect(api).toContain('next_action_due_at');
    expect(page).toContain('SLA breached');
    expect(page).toContain('BREACHED');
    expect(page).toContain('Next action');
    const detail = readRepoFile('app/super-admin/action-centre/[caseId]/page.tsx');
    const detailApi = readRepoFile('app/api/super-admin/cases/[caseId]/route.ts');
    expect(detail).toContain('Operational plan');
    expect(detail).toContain('Customer update due');
    expect(detail).toContain('Verified closure due');
    expect(detailApi).toContain("action: z.enum(['assign', 'acknowledge', 'investigate', 'wait', 'resolve', 'close', 'reopen', 'plan'])");
    expect(detailApi).toContain("owner_set_platform_case_plan");
    const migration = readRepoFile(MIGRATION);
    expect(migration).toContain('owner_set_platform_case_plan');
    expect(migration).toContain("'plan_updated'");
  });
});
