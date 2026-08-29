import fs from 'node:fs';
import path from 'node:path';

describe('Multi-drop foundation contract', () => {
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260829170500_job_stops_multidrop_foundation.sql');
  const typesPath = path.join(process.cwd(), 'apps/driver-mobile/src/jobs/types.ts');
  const jobsApiPath = path.join(process.cwd(), 'apps/driver-mobile/src/api/jobs.ts');
  const listRoutePath = path.join(process.cwd(), 'app/api/driver/mobile/jobs/route.ts');
  const detailRoutePath = path.join(process.cwd(), 'app/api/driver/mobile/jobs/[id]/route.ts');
  const statusRoutePath = path.join(process.cwd(), 'app/api/driver/mobile/jobs/[id]/stop-status/route.ts');
  const mobileAppPath = path.join(process.cwd(), 'apps/driver-mobile/src/app/DriverMobileApp.tsx');
  const migration = fs.readFileSync(migrationPath, 'utf8');
  const types = fs.readFileSync(typesPath, 'utf8');
  const jobsApi = fs.readFileSync(jobsApiPath, 'utf8');
  const listRoute = fs.readFileSync(listRoutePath, 'utf8');
  const detailRoute = fs.readFileSync(detailRoutePath, 'utf8');
  const statusRoute = fs.readFileSync(statusRoutePath, 'utf8');
  const mobileApp = fs.readFileSync(mobileAppPath, 'utf8');

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

  test('matches the existing mobile ordered-stop shape and visible Stops tab', () => {
    expect(types).toContain('export type JobStop = {');
    expect(types).toContain("type: 'collection' | 'delivery';");
    expect(types).toContain('sequence: number;');
    expect(types).toContain('stops?: JobStop[];');
    expect(mobileApp).toContain("['stops', 'Stops']");
    expect(mobileApp).toContain('function StopsTab');
    expect(mobileApp).toContain('job.stops && job.stops.length > 0');
  });

  test('projects ordered persisted stops to both list and detail APIs without breaking pre-migration environments', () => {
    expect(listRoute).toContain(".from('job_stops')");
    expect(listRoute).toContain(".order('sequence', { ascending: true })");
    expect(listRoute).toContain('multiDropPartial: stopData.partial');
    expect(detailRoute).toContain(".from('job_stops')");
    expect(detailRoute).toContain('multiDropPartial');
    expect(detailRoute).toContain('stops,');
  });

  test('enforces ordered driver stop execution without mutating parent lifecycle', () => {
    expect(statusRoute).toContain("allowedNext = new Set(['arrived', 'completed'])");
    expect(statusRoute).toContain('stop.sequence < target.sequence');
    expect(statusRoute).toContain("!['completed', 'skipped'].includes(stop.status)");
    expect(statusRoute).toContain("target.status !== 'arrived'");
    expect(statusRoute).toContain("eventType = nextStatus === 'arrived' ? 'multi_drop_stop_arrived' : 'multi_drop_stop_completed'");
    expect(statusRoute).not.toMatch(/\.from\('jobs'\)[\s\S]*\.update\(/);
    expect(jobsApi).toContain('export async function postStopStatus');
    expect(jobsApi).toContain("status: 'arrived' | 'completed'");
  });
});
