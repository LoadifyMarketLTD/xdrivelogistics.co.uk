import fs from 'node:fs';
import path from 'node:path';

const diary = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/OperationsDiaryPage.tsx'), 'utf8');
const migration = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260925033000_diary_groups.sql'), 'utf8');

describe('CX Diary Groups parity', () => {
  it('uses company-scoped group and booking-membership tables with RLS', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.diary_groups');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.diary_group_jobs');
    expect(migration).toContain("active_company_membership_role(company_id, auth.uid()) IN ('owner', 'admin', 'dispatcher')");
    expect(migration).toContain('public.is_company_non_driver(company_id)');
  });

  it('blocks cross-company booking membership at the database boundary', () => {
    expect(migration).toContain('enforce_diary_group_job_company');
    expect(migration).toContain('j.company_id = v_company_id');
    expect(migration).toContain('j.awarded_carrier_company_id = v_company_id');
    expect(migration).toContain('j.assigned_company_id = v_company_id');
    expect(migration).toContain("RAISE EXCEPTION 'Booking is outside this company workspace.'");
  });

  it('records group lifecycle and booking membership in an append-only audit trail', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.diary_group_audit');
    for (const action of ['group_created', 'group_renamed', 'group_deleted', 'job_added', 'job_removed']) expect(migration).toContain(action);
    expect(migration).toContain('diary_groups_audit_trigger');
    expect(migration).toContain('diary_group_jobs_audit_trigger');
  });

  it('exposes group filter, Add/Edit Groups and per-booking membership in Diary', () => {
    expect(diary).toContain('GROUPS');
    expect(diary).toContain('Add / Edit Groups');
    expect(diary).toContain(".from('diary_groups')");
    expect(diary).toContain(".from('diary_group_jobs')");
    expect(diary).toContain('Add to group…');
    expect(diary).toContain('removeJobFromGroup');
  });
});
