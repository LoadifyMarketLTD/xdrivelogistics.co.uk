import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const bridge = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260905012522_prepare_postgis_schema_relocation_bridge.sql',
  ),
  'utf8',
);

const executableSql = bridge.replace(/--.*$/gm, '');

describe('PostGIS relocation bridge contract', () => {
  test('accepts both legacy public and supported extensions schemas', () => {
    expect(bridge).toContain("v_postgis_schema not in ('public', 'extensions')");
    expect(bridge).toContain("where e.extname = 'postgis'");
  });

  test('pins the runtime PostGIS consumers to both schemas', () => {
    expect(bridge).toContain('alter function public.fn_sync_driver_location_coordinates()');
    expect(bridge).toContain(
      'alter function public.fn_enqueue_driver_load_alerts_for_job(uuid, uuid)',
    );
    expect(
      bridge.match(/set search_path = public, extensions, pg_catalog;/g),
    ).toHaveLength(2);
  });

  test('does not relocate or drop the managed extension itself', () => {
    expect(executableSql).not.toMatch(/drop\s+extension\s+postgis/i);
    expect(executableSql).not.toMatch(
      /alter\s+extension\s+postgis\s+set\s+schema/i,
    );
    expect(executableSql).not.toMatch(/update\s+pg_extension/i);
  });
});
