import fs from 'node:fs';
import path from 'node:path';

describe('Multi-drop foundation contract', () => {
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260829192913_job_stops_multidrop_foundation.sql');
  const typesPath = path.join(process.cwd(), 'apps/driver-mobile/src/jobs/types.ts');
  const jobsApiPath = path.join(process.cwd(), 'apps/driver-mobile/src/api/jobs.ts');
  const listRoutePath = path.join(process.cwd(), 'app/api/driver/mobile/jobs/route.ts');
  const detailRoutePath = path.join(process.cwd(), 'app/api/driver/mobile/jobs/[id]/route.ts');
  const statusRoutePath = path.join(process.cwd(), 'app/api/driver/mobile/jobs/[id]/stop-status/route.ts');
  const actionRoutePath = path.join(process.cwd(), 'app/api/driver/mobile/jobs/[id]/[action]/route.ts');
  const createRoutePath = path.join(process.cwd(), 'app/api/jobs/create/route.ts');
  const postingFormPath = path.join(process.cwd(), 'app/components/workspace/LoadPostingForm.tsx');
  const mobileAppPath = path.join(process.cwd(), 'apps/driver-mobile/src/app/DriverMobileApp.tsx');
  const migration = fs.readFileSync(migrationPath, 'utf8');
  const types = fs.readFileSync(typesPath, 'utf8');
  const jobsApi = fs.readFileSync(jobsApiPath, 'utf8');
  const listRoute = fs.readFileSync(listRoutePath, 'utf8');
  const detailRoute = fs.readFileSync(detailRoutePath, 'utf8');
  const statusRoute = fs.readFileSync(statusRoutePath, 'utf8');
  const actionRoute = fs.readFileSync(actionRoutePath, 'utf8');
  const createRoute = fs.readFileSync(createRoutePath, 'utf8');
  const postingForm = fs.readFileSync(postingFormPath, 'utf8');
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
    expect(migration).toContain('revoke all on table public.job_stops from public, anon, authenticated;');
    expect(migration).toContain('grant all on table public.job_stops to service_role;');
    expect(migration).not.toMatch(/create policy[\s\S]*job_stops/i);
  });

  test('creates an ordered multi-drop route from the real Customer/Broker booking flow', () => {
    expect(postingForm).toContain('Additional stops');
    expect(postingForm).toContain('additionalStops.map((stop) => ({');
    expect(postingForm).toContain("type: 'collection' | 'delivery'");
    expect(postingForm).toContain('Move up');
    expect(postingForm).toContain('Move down');
    expect(postingForm).toContain('Exact stop details stay private before award.');
    expect(createRoute).toContain('additionalStops: z.array(additionalStopSchema).max(8).optional().default([])');
    expect(createRoute).toContain('if (input.additionalStops.length > 0)');
    expect(createRoute).toContain(".from('job_stops')");
    expect(createRoute).toContain('.insert(stopRows)');
    expect(createRoute).toContain('sequence: 1');
    expect(createRoute).toContain('sequence: index + 2');
    expect(createRoute).toContain('sequence: input.additionalStops.length + 2');
    expect(createRoute).toContain("stop_type: 'collection'");
    expect(createRoute).toContain("stop_type: 'delivery'");
  });

  test('keeps ordinary two-point jobs legacy-compatible and defers public multi-drop publication until stops exist', () => {
    expect(createRoute).toContain('const deferPublication = input.publish && input.additionalStops.length > 0;');
    expect(createRoute).toContain("exchange_visibility: deferPublication ? 'private'");
    expect(createRoute).toContain(".eq('status', 'draft')");
    expect(createRoute).toContain("status: 'posted'");
    expect(createRoute).toContain("exchange_visibility: 'exchange'");
    expect(createRoute).toContain('additionalStopCount: input.additionalStops.length');
    expect(postingForm).toContain('No additional stops. This booking remains a standard collection → delivery job.');
  });

  test('fails closed and compensates when multi-drop persistence or publication cannot finish', () => {
    expect(createRoute).toContain('verifyMultiDropReplay');
    expect(createRoute).toContain('expectedStopCount = input.additionalStops.length + 2');
    expect(createRoute).toContain('An earlier multi-drop save did not finish cleanly.');
    expect(createRoute).toContain(".from('jobs')\n        .delete()");
    expect(createRoute).toContain('The load was not published. Please try again.');
    expect(createRoute).toContain('The draft was removed; please try again.');
  });

  test('matches the existing mobile ordered-stop shape and visible Stops tab', () => {
    expect(types).toContain('export type JobStop = {');
    expect(types).toContain("type: 'collection' | 'delivery';");
    expect(types).toContain('sequence: number;');
    expect(types).toContain("status?: 'pending' | 'arrived' | 'completed' | 'skipped';");
    expect(types).toContain('arrivedAt?: string;');
    expect(types).toContain('completedAt?: string;');
    expect(types).toContain('stops?: JobStop[];');
    expect(mobileApp).toContain("['stops', 'Stops']");
    expect(mobileApp).toContain('function StopsTab');
    expect(mobileApp).toContain('getPersistentStops(job)');
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
    expect(statusRoute).toContain('terminalStopStatuses.has(stop.status)');
    expect(statusRoute).toContain("target.status !== 'arrived'");
    expect(statusRoute).toContain(".eq('status', expectedStatus)");
    expect(statusRoute).toContain('completionSummary(stops, updatedStop)');
    expect(statusRoute).toContain("eventType = nextStatus === 'arrived' ? 'multi_drop_stop_arrived' : 'multi_drop_stop_completed'");
    expect(statusRoute).not.toMatch(/\.from\('jobs'\)[\s\S]*\.update\(/);
    expect(jobsApi).toContain('export async function postStopStatus');
    expect(jobsApi).toContain("status: 'arrived' | 'completed'");
    expect(jobsApi).toContain('allStopsCompleted: boolean;');
    expect(jobsApi).toContain('remainingStops: number;');
  });

  test('wires Driver Mobile to server-confirmed stop progression and keeps stop mutation online-only', () => {
    expect(mobileApp).toContain('postStopStatus');
    expect(mobileApp).toContain('async function submitStopStatus');
    expect(mobileApp).toContain("await postStopStatus(job.id, stopId, status, token)");
    expect(mobileApp).toContain('const refreshed = await fetchJob(job.id, token)');
    expect(mobileApp).toContain('Multi-drop stop updates require an internet connection and are not queued offline yet.');
    expect(mobileApp).toContain("label={stopActionId === stop.id ? 'Updating...' : 'Mark arrived'}");
    expect(mobileApp).toContain("label={stopActionId === stop.id ? 'Updating...' : 'Mark completed'}");
    expect(mobileApp).toContain('Complete the earlier stop before this stop becomes actionable.');
    expect(mobileApp).toContain('hasIncompletePersistentStops(job)');
  });

  test('gates POD and final delivery on persisted stop completion at the server boundary', () => {
    expect(actionRoute).toContain('async function requireMultiDropFinalizationReady');
    expect(actionRoute).toContain(".from('job_stops')");
    expect(actionRoute).toContain("if (action === 'pod')");
    expect(actionRoute).toContain("if (action === 'delivered')");
    expect(actionRoute).toContain('const stopGate = await requireMultiDropFinalizationReady(id);');
    expect(actionRoute).toContain('Complete all multi-drop stops before capturing POD or marking the job delivered.');
    expect(actionRoute).toContain("error.code === '42P01' || error.code === 'PGRST205'");
    expect(actionRoute).toContain("return respond(503, { error: 'Multi-drop completion could not be verified. Please retry.' });");
  });
});