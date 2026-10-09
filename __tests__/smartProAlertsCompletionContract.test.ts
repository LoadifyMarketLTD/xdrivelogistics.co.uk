import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Smart / Pro Alerts completion contract', () => {
  const posting = read('app/components/workspace/LoadPostingForm.tsx');
  const create = read('app/api/jobs/create/route.ts');
  const panel = read('app/components/workspace/JobSmartAlertsPanel.tsx');
  const api = read('app/api/workspace/jobs/[jobId]/smart-alerts/route.ts');
  const browserLocation = read('app/api/driver/location/route.ts');
  const telematics = read('app/api/integrations/telematics/location/route.ts');
  const alerts = read('lib/tracking/operationalAlerts.ts');
  const loadAlertMigration = read('supabase/migrations/20261009170000_complete_smart_pro_alerts.sql');
  const operationalMigration = read('supabase/migrations/20261009174000_consolidate_smart_pro_alerts.sql');
  const inboxMigration = read('supabase/migrations/20261009176000_smart_alert_inbox_channel_gate.sql');
  const notify = read('supabase/functions/notify-operational-event/index.ts');

  it('extends the existing Post Load flow with optional booking-level proximity alerts', () => {
    expect(posting).toContain('Smart / Pro Alerts');
    expect(posting).toContain('proximityAlertsEnabled');
    expect(posting).toContain('pickupAlertRadiusMiles');
    expect(posting).toContain('deliveryAlertRadiusMiles');
    expect(create).toContain('proximity_alerts_enabled: input.proximityAlertsEnabled');
    expect(create).toContain('pickup_alert_radius_miles: input.pickupAlertRadiusMiles');
    expect(create).toContain('delivery_alert_radius_miles: input.deliveryAlertRadiusMiles');
  });

  it('keeps booking-owner Smart Alert management server-authoritative', () => {
    expect(api).toContain("const MANAGE_ROLES = new Set(['owner', 'admin', 'dispatcher', 'fleet_manager'])");
    expect(api).toContain(".from('company_memberships')");
    expect(api).toContain(".eq('status', 'active')");
    expect(api).toContain("event_type: 'note'");
    expect(api).toContain("kind: 'smart_alerts_updated'");
    expect(panel).toContain('Pickup proximity');
    expect(panel).toContain('Delivery proximity');
    expect(panel).toContain('Milestones');
    expect(panel).toContain('Delivery channels');
  });

  it('uses one operational alert engine for browser GPS and telematics updates', () => {
    expect(browserLocation).toContain('maybeCreateOperationalLocationAlerts');
    expect(browserLocation).toContain("'driver_web'");
    expect(telematics).toContain('maybeCreateOperationalLocationAlerts');
    expect(telematics).toContain("'telematics'");
    expect(alerts).toContain("'pickup_proximity_alert'");
    expect(alerts).toContain("'delivery_proximity_alert'");
    expect(alerts).toContain("'tracking_eta_alert'");
    expect(alerts).toContain('distance_miles');
    expect(alerts).toContain('radius_miles');
    expect(alerts).toContain('location_postcode');
    expect(alerts).toContain('source');
  });

  it('adds idempotent proximity and milestone triggers without exposing exact coordinates in notification payloads', () => {
    expect(operationalMigration).toContain('fn_emit_job_operational_alert');
    expect(operationalMigration).toContain('trg_notify_job_smart_proximity');
    expect(operationalMigration).toContain('trg_notify_job_smart_milestones');
    expect(operationalMigration).toContain("'job_on_site_pickup_alert'");
    expect(operationalMigration).toContain("'job_loaded_alert'");
    expect(operationalMigration).toContain("'job_on_site_delivery_alert'");
    expect(operationalMigration).toContain("'job_pod_submitted_alert'");
    expect(loadAlertMigration).toContain('uq_notification_events_job_proximity_recipient');
  });

  it('extends existing Smart Load Alerts to Private Group marketplace visibility', () => {
    expect(loadAlertMigration).toContain("j.exchange_visibility in ('exchange', 'direct', 'private_group')");
    expect(loadAlertMigration).toContain('network_group_members');
    expect(loadAlertMigration).toContain('allow_load_visibility = true');
    expect(loadAlertMigration).toContain("old.visibility_group_id is distinct from new.visibility_group_id");
  });

  it('respects per-booking in-app/email/push channel gates end to end', () => {
    expect(inboxMigration).toContain("new.payload ? 'in_app_enabled'");
    expect(inboxMigration).toContain("'pickup_proximity_alert' then 'Driver near pickup'");
    expect(notify).toContain('handleOperationalSmartAlert');
    expect(notify).toContain("case 'pickup_proximity_alert'");
    expect(notify).toContain("case 'tracking_eta_alert'");
    expect(notify).toContain('event.payload.email_enabled === true');
    expect(notify).toContain('event.payload.push_enabled === true');
  });
});
