import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('driver Diary assigned artifact RLS contract', () => {
  const migration = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261009074500_reconcile_driver_diary_artifact_reads.sql'), 'utf8');

  it('uses assigned_driver_id for Diary tracking, notes and document reads', () => {
    for (const policy of ['job_tracking_select_assigned_driver','job_notes_select_assigned_driver','job_documents_select_assigned_driver']) {
      expect(migration).toContain(`drop policy if exists ${policy}`);
      expect(migration).toContain(`create policy ${policy}`);
    }
    expect(migration).toContain('d.id = j.assigned_driver_id');
    expect(migration).not.toContain('d.id = j.driver_id');
  });
});
