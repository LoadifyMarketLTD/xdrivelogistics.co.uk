import fs from 'node:fs';
import path from 'node:path';

const migration = fs
  .readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20260927165500_harden_membership_helpers_and_driver_atomic.sql',
    ),
    'utf8',
  )
  .replace(/\r\n/g, '\n');

describe('membership helpers and driver atomic authority hardening', () => {
  it('requires active profile state in company membership helpers', () => {
    for (const fn of [
      'is_company_member',
      'is_company_admin',
      'is_company_non_driver',
      'is_company_operator',
    ]) {
      expect(migration).toContain(`CREATE OR REPLACE FUNCTION public.${fn}`);
    }
    expect(migration.match(/COALESCE\(p\.status::text, ''\) = 'active'/g)?.length)
      .toBeGreaterThanOrEqual(4);
  });

  it('requires active driver company membership before atomic lifecycle mutation', () => {
    expect(migration).toContain("c.status::text = 'active'");
    expect(migration).toContain("cm.status::text = 'active'");
    expect(migration).toContain("COALESCE(p.status::text, '') = 'active'");
  });

  it('preserves POD evidence and strict status-transition contracts', () => {
    expect(migration).toContain("WHEN 'allocated' THEN 'accepted'");
    expect(migration).toContain('At least one delivery photo is required.');
    expect(migration).toContain('Recipient signature evidence does not belong to this job.');
  });

  it('keeps anonymous execution closed', () => {
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.is_company_member(uuid) FROM PUBLIC, anon',
    );
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.driver_update_job_status_atomic(',
    );
  });
});
