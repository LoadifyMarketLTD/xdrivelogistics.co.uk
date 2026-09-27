import fs from 'node:fs';
import path from 'node:path';

const migration = fs
  .readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20260927160500_harden_driver_presence_and_quote_authority.sql',
    ),
    'utf8',
  )
  .replace(/\r\n/g, '\n');

describe('driver presence and quote authority hardening', () => {
  it('blocks go-online when company or membership is inactive', () => {
    expect(migration).toContain("c.status::text = 'active'");
    expect(migration).toContain("cm.status::text = 'active'");
    expect(migration).toContain("COALESCE(d.app_access, false) = true");
  });

  it('requires an active profile before a driver can quote', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.can_authenticated_driver_quote');
    expect(migration).toContain("COALESCE(p.status::text, '') = 'active'");
  });

  it('preserves canonical operational eligibility and marketplace visibility checks', () => {
    expect(migration).toContain('public.driver_operational_eligibility(p_driver_id)');
    expect(migration).toContain('public.can_quote_marketplace_job(p_job_id, p_company_id)');
  });

  it('keeps anonymous execution closed on both helpers', () => {
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.driver_go_online()\nFROM PUBLIC, anon',
    );
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.can_authenticated_driver_quote(uuid, uuid, uuid)\nFROM PUBLIC, anon',
    );
  });
});
