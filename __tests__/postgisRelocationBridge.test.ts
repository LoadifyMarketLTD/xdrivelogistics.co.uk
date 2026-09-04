import fs from 'node:fs';
import path from 'node:path';

describe('PostGIS relocation bridge', () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260905003500_prepare_postgis_schema_relocation_bridge.sql'),
    'utf8',
  );

  test('accepts only the current and target PostGIS schemas', () => {
    expect(migration).toContain("if v_postgis_schema not in ('public', 'extensions') then");
    expect(migration).toContain("where e.extname = 'postgis'");
  });

  test('pins the two runtime PostGIS consumers across relocation', () => {
    expect(migration).toContain('alter function public.fn_sync_driver_location_coordinates()');
    expect(migration).toContain('alter function public.fn_enqueue_driver_load_alerts_for_job(uuid, uuid)');
    expect(migration.match(/set search_path = public, extensions, pg_catalog;/g)).toHaveLength(2);
  });

  test('never performs the managed extension relocation itself', () => {
    expect(migration).not.toMatch(/drop\s+extension/i);
    expect(migration).not.toMatch(/alter\s+extension\s+postgis\s+set\s+schema/i);
    expect(migration).not.toMatch(/update\s+pg_extension/i);
    expect(migration).not.toMatch(/cascade/i);
  });
});
