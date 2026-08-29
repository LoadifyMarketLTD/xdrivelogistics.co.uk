import fs from 'node:fs';
import path from 'node:path';

describe('Telematics location ingestion contract', () => {
  const routePath = path.join(process.cwd(), 'app/api/integrations/telematics/location/route.ts');
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260829165000_telematics_location_source_foundation.sql');
  const route = fs.readFileSync(routePath, 'utf8');
  const migration = fs.readFileSync(migrationPath, 'utf8');

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
});
