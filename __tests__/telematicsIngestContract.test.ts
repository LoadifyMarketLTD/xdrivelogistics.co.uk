import fs from 'node:fs';
import path from 'node:path';

describe('Telematics location ingestion contract', () => {
  const routePath = path.join(process.cwd(), 'app/api/integrations/telematics/location/route.ts');
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260829165000_telematics_location_source_foundation.sql');
  const bindingsMigrationPath = path.join(process.cwd(), 'supabase/migrations/20260829173500_telematics_driver_bindings.sql');
  const route = fs.readFileSync(routePath, 'utf8');
  const migration = fs.readFileSync(migrationPath, 'utf8');
  const bindingsMigration = fs.readFileSync(bindingsMigrationPath, 'utf8');

  test('requires signed, replay-bounded server-to-server ingestion', () => {
    expect(route).toContain("process.env.TELEMATICS_INGEST_SECRET");
    expect(route).toContain("request.headers.get('x-xdrive-timestamp')");
    expect(route).toContain("request.headers.get('x-xdrive-signature')");
    expect(route).toContain("createHmac('sha256', secret)");
    expect(route).toContain('MAX_SIGNATURE_AGE_SECONDS = 5 * 60');
    expect(route).toContain('timingSafeEqual(expected, supplied)');
  });

  test('keeps location publishing assignment and carrier scoped', () => {
    expect(route).toContain(".eq('assigned_driver_id', driverRow.id)");
    expect(route).toContain('jobRow.assigned_driver_id !== driverRow.id');
    expect(route).toContain('jobRow.awarded_carrier_company_id !== driverRow.company_id');
    expect(route).toContain('ACTIVE_JOB_STATUSES.has(statusOf(jobRow))');
  });

  test('records provenance and protects provider event idempotency', () => {
    expect(route).toContain("source: 'telematics'");
    expect(route).toContain('source_provider: provider');
    expect(route).toContain('source_event_id: eventId');
    expect(migration).toContain("check (source in ('driver_app', 'telematics'))");
    expect(migration).toContain('create unique index if not exists uq_driver_locations_telematics_event');
    expect(migration).toContain("where source = 'telematics'");
  });

  test('maps provider-native driver identity through a fail-closed binding table', () => {
    expect(bindingsMigration).toContain('create table if not exists public.telematics_driver_bindings');
    expect(bindingsMigration).toContain('unique (provider, external_driver_id)');
    expect(bindingsMigration).toContain('alter table public.telematics_driver_bindings enable row level security;');
    expect(bindingsMigration).not.toMatch(/create policy[\s\S]*telematics_driver_bindings/i);
    expect(route).toContain('provider_driver_id?: string;');
    expect(route).toContain(".from('telematics_driver_bindings')");
    expect(route).toContain(".eq('external_driver_id', providerDriverId)");
    expect(route).toContain('directDriverId !== binding.driver_id');
    expect(route).toContain('driverRow.company_id !== binding.company_id');
  });

  test('does not guess provider identities while hosted migrations are pending', () => {
    expect(route).toContain("if (!directDriverId) return json(503, { error: 'Telematics provider identity mapping is not available yet.' })");
    expect(route).toContain("return json(403, { error: 'Telematics driver identity is not bound to XDrive.' })");
  });
});
