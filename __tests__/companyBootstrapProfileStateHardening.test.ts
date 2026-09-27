import fs from 'node:fs';
import path from 'node:path';

const migration = fs
  .readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20260927171500_harden_company_bootstrap_profile_state.sql',
    ),
    'utf8',
  )
  .replace(/\r\n/g, '\n');

describe('company bootstrap profile-state hardening', () => {
  it('requires an active profile for compatibility company resolution', () => {
    expect(migration).toContain('Active profile is required to resolve company context.');
    expect(migration).toContain("COALESCE(p.status::text, '') = 'active'");
  });

  it('requires an active profile before membership bootstrap', () => {
    expect(migration).toContain('Active profile is required to bootstrap company membership.');
  });

  it('preserves approved-onboarding and active-company repair gates', () => {
    expect(migration).toContain("oa.status::text = 'approved'");
    expect(migration).toContain("v_company_status IS DISTINCT FROM 'active'");
    expect(migration).toContain('Missing membership cannot be self-created');
  });

  it('prevents inactive creators from using pending-company creator authority', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.is_company_creator');
    expect(migration).toContain("c.status::text = 'pending_approval'");
    expect(migration).toContain("COALESCE(p.status::text, '') = 'active'");
  });
});
