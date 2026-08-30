import fs from 'node:fs';
import path from 'node:path';

const notificationArchitecture = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/071_notification_architecture.sql'), 'utf8');
const notificationProcessor = fs.readFileSync(path.join(process.cwd(), 'supabase/functions/notify-operational-event/index.ts'), 'utf8');
const driverDashboard = fs.readFileSync(path.join(process.cwd(), 'app/driver/page.tsx'), 'utf8');
const futurePosition = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/096_driver_future_position_columns.sql'), 'utf8');
const audit = fs.readFileSync(path.join(process.cwd(), 'docs/canonical/CX_LOAD_ALERTS_NOTIFICATION_PARITY_AUDIT_2026-08-29.md'), 'utf8');

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
    expect(driverDashboard).toContain('availability_status');
    expect(driverDashboard).toContain('loadMatchesAssignedVehicle');
    expect(futurePosition).toContain('future_position');
    expect(futurePosition).toContain('future_position_date');
  });

  it('does not misclassify ordinary notifications as a personalised load-alert producer', () => {
    expect(notificationArchitecture).not.toContain("'load_alert'");
    expect(notificationArchitecture).not.toContain("'load_match'");
    expect(notificationArchitecture).not.toContain("'load_available_nearby'");
    expect(audit).toContain('BLOCKED-BY-CONTRACT');
    expect(audit).toContain('must not fabricate the missing feature with localStorage-only switches');
  });
});
