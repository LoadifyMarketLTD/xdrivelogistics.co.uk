import fs from 'node:fs';
import path from 'node:path';

describe('Multi-drop foundation contract', () => {
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260829170500_job_stops_multidrop_foundation.sql');
  const typesPath = path.join(process.cwd(), 'apps/driver-mobile/src/jobs/types.ts');
  const migration = fs.readFileSync(migrationPath, 'utf8');
  const types = fs.readFileSync(typesPath, 'utf8');

  test('persists ordered collection and delivery stops separately from job lifecycle', () => {
    expect(migration).toContain('create table if not exists public.job_stops');
    expect(migration).toContain("stop_type in ('collection', 'delivery')");
    expect(migration).toContain('unique (job_id, sequence)');
    expect(migration).toContain("status in ('pending', 'arrived', 'completed', 'skipped')");
    expect(migration).toContain('must not replace or mutate the canonical parent job lifecycle implicitly');
  });

  test('keeps the new stop table fail-closed to direct clients', () => {
    expect(migration).toContain('alter table public.job_stops enable row level security;');
    expect(migration).not.toMatch(/create policy[\s\S]*job_stops/i);
  });

  test('matches the existing mobile ordered-stop shape', () => {
    expect(types).toContain('export type JobStop = {');
    expect(types).toContain("type: 'collection' | 'delivery';");
    expect(types).toContain('sequence: number;');
    expect(types).toContain('stops?: JobStop[];');
  });
});
