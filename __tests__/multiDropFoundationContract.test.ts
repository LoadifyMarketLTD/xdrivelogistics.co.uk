import fs from 'node:fs';
import path from 'node:path';

describe('Multi-drop foundation server contract', () => {
  const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
  const migration = read('supabase/migrations/20260829192913_job_stops_multidrop_foundation.sql');
  const listRoute = read('app/api/driver/mobile/jobs/route.ts');
  const detailRoute = read('app/api/driver/mobile/jobs/[id]/route.ts');
  const statusRoute = read('app/api/driver/mobile/jobs/[id]/stop-status/route.ts');
  const actionRoute = read('app/api/driver/mobile/jobs/[id]/[action]/route.ts');
  const createRoute = read('app/api/jobs/create/route.ts');
  const postingForm = read('app/components/workspace/LoadPostingForm.tsx');

  test('persists ordered collection and delivery stops separately from job lifecycle', () => {
    expect(migration).toContain('create table if not exists public.job_stops');
    expect(migration).toContain("stop_type in ('collection', 'delivery')");
    expect(migration).toContain('unique (job_id, sequence)');
    expect(migration).toContain("status in ('pending', 'arrived', 'completed', 'skipped')");
    expect(migration).toContain('must not replace or mutate the canonical parent job lifecycle implicitly');
  });

  test('keeps the stop table fail-closed to direct clients', () => {
    expect(migration).toContain('alter table public.job_stops enable row level security;');
    expect(migration).toContain('revoke all on table public.job_stops from public, anon, authenticated;');
    expect(migration).toContain('grant all on table public.job_stops to service_role;');
    expect(migration).not.toMatch(/create policy[\s\S]*job_stops/i);
  });

  test('creates an ordered multi-drop route from the real Customer/Broker booking flow', () => {
    expect(postingForm).toContain('Additional stops');
    expect(postingForm).toContain('additionalStops.map((stop) => ({');
    expect(postingForm).toContain("type: 'collection' | 'delivery'");
    expect(createRoute).toContain('additionalStops: z.array(additionalStopSchema).max(8).optional().default([])');
    expect(createRoute).toContain('if (input.additionalStops.length > 0)');
    expect(createRoute).toContain(".from('job_stops')");
    expect(createRoute).toContain('.insert(stopRows)');
    expect(createRoute).toContain('sequence: index + 2');
  });

  test('defers public multi-drop publication until stops exist and compensates on failure', () => {
    expect(createRoute).toContain('const deferPublication = wantsExchangePublication && input.additionalStops.length > 0;');
    expect(createRoute).toContain("exchange_visibility: deferPublication ? 'private'");
    expect(createRoute).toContain('verifyMultiDropReplay');
    expect(createRoute).toContain('expectedStopCount = input.additionalStops.length + 2');
    expect(createRoute).toContain('An earlier multi-drop save did not finish cleanly.');
    expect(createRoute).toContain(".from('jobs')");
    expect(createRoute).toContain('.delete()');
  });

  test('projects ordered persisted stops to list and detail APIs', () => {
    expect(listRoute).toContain(".from('job_stops')");
    expect(listRoute).toContain(".order('sequence', { ascending: true })");
    expect(listRoute).toContain('multiDropPartial: stopData.partial');
    expect(detailRoute).toContain(".from('job_stops')");
    expect(detailRoute).toContain('multiDropPartial');
    expect(detailRoute).toContain('stops: persistentStops.length > 0 ? persistentStops : operational.legacyStops');
  });

  test('enforces ordered stop execution without directly mutating the parent job', () => {
    expect(statusRoute).toContain("allowedNext = new Set(['arrived', 'completed'])");
    expect(statusRoute).toContain('stop.sequence < target.sequence');
    expect(statusRoute).toContain('terminalStopStatuses.has(stop.status)');
    expect(statusRoute).toContain('completionSummary(stops, updatedStop)');
    expect(statusRoute).not.toMatch(/\.from\('jobs'\)\s*\.update\(/);
    expect(statusRoute).toContain(".from('job_stops')");
    expect(statusRoute).toContain('.update(update)');
  });

  test('gates POD and final delivery on persisted stop completion at the server boundary', () => {
    expect(actionRoute).toContain('async function requireMultiDropFinalizationReady');
    expect(actionRoute).toContain(".from('job_stops')");
    expect(actionRoute).toContain("if (action === 'pod')");
    expect(actionRoute).toContain("if (action === 'delivered')");
    expect(actionRoute).toContain('Complete all multi-drop stops before capturing POD or marking the job delivered.');
  });
});
