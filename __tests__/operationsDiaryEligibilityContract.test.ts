import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const diary = fs.readFileSync(path.join(root, 'app/components/workspace/OperationsDiaryPage.tsx'), 'utf8');
const assignment = fs.readFileSync(path.join(root, 'supabase/migrations/110_assign_job_driver_atomic.sql'), 'utf8');

describe('Operations Diary driver eligibility contract', () => {
  it('fails closed when the driver account status is absent', () => {
    expect(diary).toContain("return Boolean(status) && !['suspended', 'inactive', 'rejected'].includes(status)");
    expect(assignment).toContain('IF v_driver_status IS NULL');
  });

  it('keeps the UI blocked account statuses aligned with the canonical assignment RPC', () => {
    for (const status of ['suspended', 'inactive', 'rejected']) {
      expect(diary).toContain(status);
      expect(assignment).toContain(status);
    }
  });

  it('keeps final allocation mutation behind assign_job_driver_atomic', () => {
    expect(diary).toContain('/api/admin/jobs/${encodeURIComponent(job.id)}/assign-driver');
    expect(assignment).toContain('CREATE OR REPLACE FUNCTION public.assign_job_driver_atomic');
  });
});
