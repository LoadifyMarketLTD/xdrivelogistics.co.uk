import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('driver load alert operational availability gate', () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260925195000_load_alerts_respect_driver_availability.sql'),
    'utf8',
  );

  it('only matches active app drivers who are operationally available', () => {
    expect(migration).toContain("d.app_access=true AND d.status='active' AND d.availability_status='available'");
  });

  it('keeps future-position matching in the same authoritative matcher', () => {
    expect(migration).toContain('c.future_position_enabled');
    expect(migration).toContain("THEN 'future_position'");
  });

  it('keeps the matcher server-only', () => {
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.fn_enqueue_driver_load_alerts_for_job(uuid,uuid) FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.fn_enqueue_driver_load_alerts_for_job(uuid,uuid) TO service_role');
  });
});
