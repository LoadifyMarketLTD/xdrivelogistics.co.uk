import fs from 'node:fs';
import path from 'node:path';

const migration = fs
  .readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20260927154500_harden_assigned_driver_job_authority.sql',
    ),
    'utf8',
  )
  .replace(/\r\n/g, '\n');

describe('assigned driver job authority hardening', () => {
  it('requires active driver, profile, company and membership state', () => {
    expect(migration).toContain("COALESCE(d.status::text, '') = 'active'");
    expect(migration).toContain("COALESCE(p.status::text, '') = 'active'");
    expect(migration).toContain("c.status::text = 'active'");
    expect(migration).toContain("cm.status::text = 'active'");
  });

  it('requires the assigned job to belong to the driver company execution context', () => {
    expect(migration).toContain('j.company_id = d.company_id');
    expect(migration).toContain('j.assigned_company_id = d.company_id');
    expect(migration).toContain('j.awarded_carrier_company_id = d.company_id');
  });

  it('makes update authority reuse the hardened read/access contract', () => {
    expect(migration).toContain(
      'SELECT public.can_driver_access_job(jid);',
    );
  });

  it('keeps anonymous execution closed', () => {
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.can_driver_access_job(uuid)\nFROM PUBLIC, anon',
    );
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.can_driver_update_job(uuid)\nFROM PUBLIC, anon',
    );
  });
});
