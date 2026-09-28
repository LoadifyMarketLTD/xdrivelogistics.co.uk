import fs from 'node:fs';
import path from 'node:path';

const notificationArchitecture = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/071_notification_architecture.sql'), 'utf8');
const notificationProcessor = fs.readFileSync(path.join(process.cwd(), 'supabase/functions/notify-operational-event/index.ts'), 'utf8');
const loadAlertsFoundation = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260829193038_driver_load_alerts_foundation.sql'), 'utf8');
const availabilityGate = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260925195000_load_alerts_respect_driver_availability.sql'), 'utf8');
const loadAlertsApi = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/load-alert-preferences/route.ts'), 'utf8');

describe('CX load-alert contract gap', () => {
  it('keeps the real notification delivery foundation visible', () => {
    expect(notificationArchitecture).toContain('notification_events');
    expect(notificationArchitecture).toContain("'job_assigned'");
    expect(notificationArchitecture).toContain("'bid_accepted'");
    expect(notificationArchitecture).toContain("'pod_uploaded'");
    expect(notificationProcessor).toContain('sendEmail(');
    expect(notificationProcessor).toContain('sendFcmMessage');
  });

  it('reuses real availability, vehicle and future-position inputs rather than inventing replacements', () => {
    expect(availabilityGate).toContain("d.availability_status='available'");
    expect(availabilityGate).toContain('p.require_vehicle_match');
    expect(availabilityGate).toContain('v.vehicle_type');
    expect(availabilityGate).toContain('c.future_position');
    expect(availabilityGate).toContain('c.future_position_date');
    expect(loadAlertsApi).toContain("select('future_position, future_position_date, availability_status')");
    expect(loadAlertsApi).toContain("select('vehicle_type, type, reg_plate')");
  });

  it('uses a real personalised load-alert producer and delivery contract', () => {
    expect(loadAlertsFoundation).toContain('driver_load_alert_preferences');
    expect(loadAlertsFoundation).toContain("'load_alert'");
    expect(loadAlertsFoundation).toContain('fn_enqueue_driver_load_alerts_for_user');
    expect(loadAlertsApi).toContain("supabaseAdmin.rpc('fn_enqueue_driver_load_alerts_for_user'");
    expect(notificationProcessor).toContain("case 'load_alert': success = await handleLoadAlert(event); break;");
  });
});
