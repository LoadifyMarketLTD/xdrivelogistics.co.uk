import fs from 'node:fs';
import path from 'node:path';

describe('Driver Smart Load Alerts contract', () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260829193038_driver_load_alerts_foundation.sql'),
    'utf8',
  );
  const delivery = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260829193123_load_alert_notification_delivery_contract.sql'),
    'utf8',
  );
  const api = fs.readFileSync(
    path.join(process.cwd(), 'app/api/driver/load-alert-preferences/route.ts'),
    'utf8',
  );
  const worker = fs.readFileSync(
    path.join(process.cwd(), 'supabase/functions/notify-operational-event/index.ts'),
    'utf8',
  );
  const page = fs.readFileSync(
    path.join(process.cwd(), 'app/driver/load-alerts/page.tsx'),
    'utf8',
  );
  const accountNav = fs.readFileSync(
    path.join(process.cwd(), 'app/driver/_components/AccountSectionNav.tsx'),
    'utf8',
  );
  const shell = fs.readFileSync(
    path.join(process.cwd(), 'app/driver/_components/DriverWorkspaceShell.tsx'),
    'utf8',
  );

  test('persists opt-in personal preferences behind strict ownership boundaries', () => {
    expect(migration).toContain('create table if not exists public.driver_load_alert_preferences');
    expect(migration).toContain('alter table public.driver_load_alert_preferences enable row level security');
    expect(migration).toContain('user_id = auth.uid()');
    expect(migration).toContain('unique (user_id)');
    expect(migration).toContain('check (not enabled or current_radius_enabled or home_outcode_enabled or future_position_enabled)');
    expect(migration).toContain('check (not enabled or in_app_enabled or email_enabled or push_enabled)');
    expect(api).toContain('requireActiveWebDriver(request)');
    expect(api).toContain(".eq('driver_id', driver.driverId)");
    expect(api).toContain(".eq('user_id', driver.userId)");
  });

  test('reconciles the marketplace expiry column before matcher functions depend on it', () => {
    expect(migration).toContain('add column if not exists exchange_expires_at timestamptz;');
    expect(migration).toContain('j.exchange_expires_at');
    expect(migration).toContain('(j.exchange_expires_at is null or j.exchange_expires_at > now())');
  });

  test('normalizes outcodes case-insensitively before filtering characters', () => {
    expect(migration).toContain("regexp_replace(upper(coalesce(p_value, '')), '[^A-Z0-9 ]', '', 'g')");
  });

  test('matches server-side without exposing exact tracking coordinates in alert payloads', () => {
    expect(migration).toContain('st_dwithin(');
    expect(migration).toContain('current_location_max_age_minutes');
    expect(migration).toContain("then 'current_location'");
    expect(migration).toContain("then 'home_outcode'");
    expect(migration).toContain("then 'future_position'");
    expect(migration).toContain("'pickup_outcode'");
    expect(migration).toContain("'delivery_outcode'");
    expect(migration).not.toContain("'pickup_lat', m.pickup_lat");
    expect(migration).not.toContain("'pickup_lng', m.pickup_lng");
    expect(page).toContain('Exact live coordinates stay private and are used only for matching.');
  });

  test('uses vehicle/budget filters and idempotent recipient delivery', () => {
    expect(migration).toContain('require_vehicle_match');
    expect(migration).toContain('minimum_budget_gbp');
    expect(migration).toContain('uq_notification_events_load_alert_recipient');
    expect(migration).toContain("where event_type = 'load_alert'");
    expect(migration).toContain('on conflict do nothing');
    expect(migration).toContain("'load_alert'");
  });

  test('honours recipient channel preferences across inbox, email and push', () => {
    expect(delivery).toContain("when 'load_alert'");
    expect(delivery).toContain("new.event_type = 'load_alert'");
    expect(delivery).toContain("new.payload->>'in_app_enabled'");
    expect(worker).toContain('async function handleLoadAlert(event: NotificationEvent)');
    expect(worker).toContain("event.payload.email_enabled === true");
    expect(worker).toContain("event.payload.push_enabled === true");
    expect(worker).toContain("case 'load_alert': success = await handleLoadAlert(event); break;");
    expect(worker).toContain("event_type: 'load_alert'");
  });

  test('keeps catch-up matching recipient-scoped', () => {
    expect(migration).toContain('create or replace function public.fn_enqueue_driver_load_alerts_for_user(p_user_id uuid)');
    expect(migration).toContain('if p_user_id is null then return 0; end if;');
    expect(migration).toContain('p.user_id = p_recipient_user_id');
    expect(api).toContain("supabaseAdmin.rpc('fn_enqueue_driver_load_alerts_for_user', { p_user_id: driver.userId })");
  });

  test('exposes a real settings surface without changing the Driver primary navigation', () => {
    expect(accountNav).toContain("{ label: 'Load Alerts', href: '/driver/load-alerts' }");
    expect(shell).toContain("'/driver/load-alerts': 'Load Alerts'");
    expect(shell).toContain("'/driver/load-alerts'");
    expect(page).toContain("fetch('/api/driver/load-alert-preferences'");
    expect(page).toContain('Send me matching load alerts');
    expect(page).toContain('Require vehicle match');
    expect(page).toContain('Save Load Alerts');
  });

  test('fails honestly when the hosted schema is not available', () => {
    expect(api).toContain("code: 'LOAD_ALERT_SCHEMA_UNAVAILABLE'");
    expect(page).toContain("payload.code === 'LOAD_ALERT_SCHEMA_UNAVAILABLE'");
    expect(page).toContain('they are not active in this environment yet. No alert settings have been applied here.');
  });
});