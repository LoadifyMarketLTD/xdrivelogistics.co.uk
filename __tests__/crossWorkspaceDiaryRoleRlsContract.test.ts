import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261009090500_cross_workspace_diary_role_reads.sql'), 'utf8');
const groupViewerReads = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261009091000_cross_workspace_diary_group_viewer_reads.sql'), 'utf8');

describe('cross-workspace Diary role read contract', () => {
  it('adds a non-driver company job viewer boundary for app roles that own jobs.view', () => {
    for (const role of ['owner','admin','dispatcher','member','fleet_manager','finance','viewer']) {
      expect(source).toContain(role);
    }
    expect(source).toContain("coalesce(p.role, '') <> 'driver'");
    expect(source).toContain('jobs_select_company_job_viewer');
    expect(source).toContain('jobs_assigned_company_job_viewer');
  });

  it('keeps Diary feedback readable for authorised company viewers without granting mutations', () => {
    expect(source).toContain('reviews_select_company_diary_viewer');
    expect(source).toContain('for select');
    expect(source).not.toContain('reviews_insert_company_diary_viewer');
    expect(source).not.toContain('reviews_update_company_diary_viewer');
  });

  it('repairs Fleet Manager group reads to match existing group mutation authority', () => {
    expect(source).toContain('diary_groups_select_fleet_manager');
    expect(source).toContain('diary_group_jobs_select_fleet_manager');
    expect(source).toContain("= 'fleet_manager'");
    expect(groupViewerReads).toContain('diary_groups_select_job_viewer');
    expect(groupViewerReads).toContain('diary_group_jobs_select_job_viewer');
  });
});
