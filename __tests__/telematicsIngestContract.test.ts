import fs from 'node:fs';
import path from 'node:path';

describe('Telematics location ingestion contract', () => {
  const routePath = path.join(process.cwd(), 'app/api/integrations/telematics/location/route.ts');
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260829192805_telematics_location_source_foundation.sql');
  const bindingsMigrationPath = path.join(process.cwd(), 'supabase/migrations/20260829192952_telematics_driver_bindings.sql');
  const route = fs.readFileSync(routePath, 'utf8');
  const migration = fs.readFileSync(migrationPath, 'utf8');
  const bindingsMigration = fs.readFileSync(bindingsMigrationPath, 'utf8');

  test('requires provider-scoped signed, replay-bounded server-to-server ingestion', () => {
    expect(route).toContain('process.env.TELEMATICS_INGEST_SECRETS_JSON');
    expect(route).toContain('process.env.TELEMATICS_INGEST_PROVIDER');
    expect(route).toContain('process.env.TELEMATICS_INGEST_SECRET');
    expect(route).toContain("request.headers.get('x-xdrive-timestamp')");
    expect(route).toContain("request.headers.get('x-xdrive-signature')");
    expect(route).toContain("createHmac('sha256', secret)");
    expect(route).toContain('MAX_SIGNATURE_AGE_SECONDS = 5 * 60');
    expect(route).toContain('timingSafeEqual(expected, supplied)');
    expect(route).toContain('verifySignature(rawBody, request, provider)');
    expect(route).toContain('legacyProvider === provider');
  });

  test('keeps location publishing assignment, carrier and canonical vehicle scoped', () => {
    expect(route).toContain(".eq('assigned_driver_id', driverRow.id)");
    expect(route).toContain('jobRow.assigned_driver_id !== driverRow.id');
    expect(route).toContain('jobRow.awarded_carrier_company_id !== binding.company_id');
    expect(route).toContain('jobRow.vehicle_id !== vehicleRow.id');
    expect(route).toContain('ACTIVE_JOB_STATUSES.has(statusOf(jobRow))');
    expect(route).toContain(".from('vehicles')");
    expect(route).toContain(".eq('id', binding.vehicle_id)");
    expect(route).toContain(".eq('company_id', binding.company_id)");
    expect(route).toContain(".eq('status', 'active')");
  });

  test('records canonical provenance and protects provider event idempotency', () => {
    expect(route).toContain("source: 'telematics'");
    expect(route).toContain('source_provider: provider');
    expect(route).toContain('source_event_id: eventId');
    expect(route).toContain('vehicle_id: vehicleRow.id');
    expect(route).toContain('company_id: binding.company_id');
    expect(route).toContain('job_id: jobRow.id');
    expect(migration).toContain("check (source in ('driver_app', 'telematics'))");
    expect(migration).toContain('driver_locations_telematics_provenance_check');
    expect(migration).toContain("source = 'driver_app'");
    expect(migration).toContain('and source_provider is null');
    expect(migration).toContain('and source_event_id is null');
    expect(migration).toContain("source = 'telematics'");
    expect(migration).toContain('and vehicle_id is not null');
    expect(migration).toContain('and company_id is not null');
    expect(migration).toContain('and job_id is not null');
    expect(migration).toContain('create unique index if not exists uq_driver_locations_telematics_event');
    expect(migration).toContain("where source = 'telematics'");
  });

  test('reserves telematics provenance for the service-role integration boundary', () => {
    expect(migration).toContain('drop policy if exists driver_locations_insert_self on public.driver_locations;');
    expect(migration).toContain('create policy driver_locations_insert_self');
    expect(migration).toContain('drop policy if exists driver_locations_update_self on public.driver_locations;');
    expect(migration).toContain('create policy driver_locations_update_self');
    expect(migration).toContain("source = 'driver_app'");
    expect(migration).toContain('source_provider is null');
    expect(migration).toContain('source_event_id is null');
  });

  test('reconciles numeric coordinates with the canonical geography column', () => {
    expect(migration).toContain('create or replace function public.fn_sync_driver_location_coordinates()');
    expect(migration).toContain("if tg_op = 'UPDATE'");
    expect(migration).toContain('new.location is distinct from old.location');
    expect(migration).toContain('new.lat is not distinct from old.lat');
    expect(migration).toContain('new.lng is not distinct from old.lng');
    expect(migration).toContain('new.location := st_setsrid(st_makepoint(new.lng, new.lat), 4326)::geography;');
    expect(migration).toContain('new.lat := st_y(new.location::geometry);');
    expect(migration).toContain('new.lng := st_x(new.location::geometry);');
    expect(migration).toContain('drop trigger if exists trg_sync_driver_location_coordinates on public.driver_locations;');
    expect(migration).toContain('before insert or update of location, lat, lng on public.driver_locations');
  });

  test('maps provider-native driver and vehicle identities through a fail-closed binding table', () => {
    expect(bindingsMigration).toContain('create table if not exists public.telematics_driver_bindings');
    expect(bindingsMigration).toContain('external_vehicle_id text not null');
    expect(bindingsMigration).toContain('vehicle_id uuid not null references public.vehicles(id)');
    expect(bindingsMigration).toContain('company_id uuid not null references public.companies(id)');
    expect(bindingsMigration).toContain('unique (provider, external_driver_id)');
    expect(bindingsMigration).toContain('unique (provider, external_vehicle_id)');
    expect(bindingsMigration).toContain('revoked_at timestamptz');
    expect(bindingsMigration).toContain('alter table public.telematics_driver_bindings enable row level security;');
    expect(bindingsMigration).toContain('revoke all on table public.telematics_driver_bindings from public, anon, authenticated;');
    expect(bindingsMigration).toContain('grant all on table public.telematics_driver_bindings to service_role;');
    expect(bindingsMigration).not.toMatch(/create policy[\s\S]*telematics_driver_bindings/i);
    expect(route).toContain('provider_driver_id?: string;');
    expect(route).toContain('provider_vehicle_id?: string;');
    expect(route).toContain("if (!providerDriverId) return json(400, { error: 'provider_driver_id is required.' })");
    expect(route).toContain("if (!providerVehicleId) return json(400, { error: 'provider_vehicle_id is required.' })");
    expect(route).toContain(".from('telematics_driver_bindings')");
    expect(route).toContain(".eq('external_driver_id', providerDriverId)");
    expect(route).toContain(".eq('external_vehicle_id', providerVehicleId)");
    expect(route).toContain(".eq('enabled', true)");
    expect(route).toContain(".is('revoked_at', null)");
    expect(route).toContain('directDriverId !== binding.driver_id');
    expect(route).toContain('driverRow.company_id !== binding.company_id');
  });

  test('does not accept canonical driver ids as a substitute for provider bindings', () => {
    expect(route).toContain("return json(503, { error: 'Telematics provider identity mapping is not available yet.' })");
    expect(route).toContain("return json(403, { error: 'Telematics driver and vehicle identities are not bound to XDrive.' })");
    expect(route).not.toContain('let resolvedDriverId = directDriverId');
  });
});