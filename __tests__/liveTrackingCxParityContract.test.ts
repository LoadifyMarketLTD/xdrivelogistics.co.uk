import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const publisher = readFileSync(resolve(process.cwd(), 'app/hooks/useDriverLocationPublisher.ts'), 'utf8');
const ingest = readFileSync(resolve(process.cwd(), 'app/api/driver/location/route.ts'), 'utf8');
const readApi = readFileSync(resolve(process.cwd(), 'app/api/tracking/jobs/[jobId]/route.ts'), 'utf8');
const trafficEta = readFileSync(resolve(process.cwd(), 'lib/tracking/trafficEta.ts'), 'utf8');
const etaMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260826095500_job_tracking_eta_cache.sql'), 'utf8');
const customer = readFileSync(resolve(process.cwd(), 'app/customer/jobs/[id]/page.tsx'), 'utf8');
const broker = readFileSync(resolve(process.cwd(), 'app/broker/jobs/page.tsx'), 'utf8');
const driverLocationSchema = readFileSync(resolve(process.cwd(), 'supabase/migrations/015_add_driver_app_columns.sql'), 'utf8');

describe('CX-style live job tracking contract', () => {
  it('publishes browser GPS throughout the complete active execution lifecycle', () => {
    for (const status of ['allocated', 'on_my_way', 'on_site_pickup', 'loaded', 'in_transit', 'on_site_delivery']) {
      expect(publisher).toContain(`'${status}'`);
    }
    expect(publisher).toContain('navigator.geolocation.watchPosition');
    expect(publisher).toContain("fetch('/api/driver/location'");
  });

  it('binds accepted GPS points to exactly one active assigned job', () => {
    expect(ingest).toContain(".eq('assigned_driver_id', driverRow.id)");
    expect(ingest).toContain('active.length !== 1');
    expect(ingest).toContain('job_id: jobRow.id');
    expect(ingest).toContain('jobRow.assigned_driver_id !== driverRow.id');
    expect(driverLocationSchema).toContain('job_id      uuid        REFERENCES public.jobs(id) ON DELETE SET NULL');
  });

  it('limits job tracking reads to the poster, awarded carrier, or assigned driver', () => {
    expect(readApi).toContain('posterAccess');
    expect(readApi).toContain('carrierAccess');
    expect(readApi).toContain('driverSelf');
    expect(readApi).toContain("return json(403, { error: 'You do not have access to tracking for this job.' })");
    expect(readApi).toContain(".eq('job_id', job.id)");
    expect(readApi).toContain(".eq('driver_id', job.assigned_driver_id)");
  });

  it('ends external location visibility outside active execution without treating legacy Kotlin as canonical evidence', () => {
    expect(readApi).toContain('tracking_active: false');
    expect(readApi).toContain("['delivered', 'completed', 'invoiced', 'paid']");
  });

  it('exposes authorised live tracking to both customer and broker job surfaces', () => {
    expect(customer).toContain('import JobLiveTrackingPanel');
    expect(customer).toContain('<JobLiveTrackingPanel jobId={job.id} />');
    expect(broker).toContain('import JobLiveTrackingPanel');
    expect(broker).toContain('<JobLiveTrackingPanel jobId={job.id} />');
  });

  it('keeps traffic-aware ETA economical and independent of viewer count', () => {
    expect(trafficEta).toContain('const ETA_REFRESH_MS = 15 * 60_000');
    expect(trafficEta).toContain('mapbox/driving-traffic');
    expect(trafficEta).toContain('ABSOLUTE_MONTHLY_REQUEST_CAP = 90_000');
    expect(trafficEta).toContain("admin.rpc('reserve_tracking_provider_request'");
    expect(readApi).toContain('readTrafficEtaSnapshot');
    expect(readApi).not.toContain('mapbox/driving-traffic');
    expect(ingest).toContain('DELIVERY_ETA_STATUSES');
    expect(ingest).toContain("event_type: 'tracking_eta_alert'");
    expect(etaMigration).toContain('tracking_provider_usage_monthly');
    expect(etaMigration).toContain('reserve_tracking_provider_request');
    expect(etaMigration).toContain('REVOKE ALL ON TABLE public.tracking_provider_usage_monthly FROM PUBLIC, anon, authenticated');
  });
});
