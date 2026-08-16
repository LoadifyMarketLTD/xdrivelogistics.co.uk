import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const diary = fs.readFileSync(path.join(root, 'app/components/workspace/OperationsDiaryPage.tsx'), 'utf8');
const readiness = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260815114500_canonical_driver_vehicle_readiness.sql'),
  'utf8',
);
const assignment = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260816102500_preserve_fleet_reallocation_lifecycle.sql'),
  'utf8',
);

describe('Operations Diary driver eligibility contract', () => {
  it('keeps the client roster conservative and leaves full eligibility to the server', () => {
    expect(diary).toContain("normalise(driver.status) === 'active'");
    expect(diary).toContain('Full operational eligibility is verified by the server.');
  });

  it('uses the canonical fail-closed driver and vehicle readiness contract', () => {
    expect(readiness).toContain('CREATE OR REPLACE FUNCTION public.driver_operational_eligibility');
    expect(readiness).toContain("v_driver.status::text, '') <> 'active'");
    expect(readiness).toContain('driver_account_not_active');
    expect(readiness).toContain('driver_onboarding_not_approved');
    expect(readiness).toContain('driver_company_membership_not_active');
    expect(readiness).toContain('canonical_vehicle_missing');
    expect(readiness).toContain('canonical_vehicle_ambiguous');
    expect(readiness).toContain('vehicle_document_missing_or_invalid:mot');
    expect(readiness).toContain('vehicle_document_missing_or_invalid:insurance');
  });

  it('keeps final allocation behind the current assign_job_driver_atomic implementation', () => {
    expect(diary).toContain('/api/admin/jobs/${encodeURIComponent(job.id)}/assign-driver');
    expect(assignment).toContain('CREATE OR REPLACE FUNCTION public.assign_job_driver_atomic');
    expect(assignment).toContain('FROM public.driver_operational_eligibility(p_driver_id) readiness');
    expect(assignment).toContain('IF NOT COALESCE(v_driver_eligible, false) OR v_driver_vehicle_id IS NULL');
    expect(assignment).toContain('vehicle_id = CASE WHEN p_driver_id IS NULL THEN NULL ELSE v_driver_vehicle_id END');
  });
});
