import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/functions/notify-operational-event/index.ts'),
  'utf8',
);

describe('operational tracking email contract', () => {
  it('loads human booking context and recent live location server-side', () => {
    expect(source).toContain('getSmartAlertEmailContext(event)');
    expect(source).toContain(".from('driver_locations')");
    expect(source).toContain(".select('lat,lng,speed_mph,recorded_at')");
    expect(source).toContain('15 * 60_000');
    expect(source).toContain('https://www.google.com/maps/search/?api=1&query=');
  });

  it('renders full operational context without exposing the internal job id', () => {
    const handler = source.slice(
      source.indexOf('async function handleOperationalSmartAlert'),
      source.indexOf('async function handleOnboardingInvite'),
    );
    expect(handler).toContain('Booking ref');
    expect(handler).toContain('Collection');
    expect(handler).toContain('Delivery');
    expect(handler).toContain('Vehicle');
    expect(handler).toContain('Distance');
    expect(handler).toContain('ETA');
    expect(handler).toContain('View current vehicle location');
    expect(handler).toContain("sender: SenderKind = event.event_type === 'job_pod_submitted_alert' ? 'pod' : 'operations'");
    expect(handler).not.toContain('Booking ref</td><td style="padding:7px 0">${escapeHtml(jobId)}');
  });

  it('uses milestone-specific human subjects', () => {
    expect(source).toContain("pickup_proximity_alert: 'Vehicle approaching collection'");
    expect(source).toContain("delivery_proximity_alert: 'Vehicle approaching delivery'");
    expect(source).toContain("tracking_eta_alert: 'Vehicle ETA update'");
    expect(source).toContain("job_on_site_pickup_alert: 'Vehicle on site at collection'");
    expect(source).toContain("job_loaded_alert: 'Load collected - vehicle en route'");
    expect(source).toContain("job_on_site_delivery_alert: 'Vehicle on site at delivery'");
    expect(source).toContain('smartAlertSubject(event.event_type, context.reference)');
  });
});
