import fs from 'node:fs';
import path from 'node:path';

const migration = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260925041500_user_notification_preferences.sql'), 'utf8');
const edge = fs.readFileSync(path.join(process.cwd(), 'supabase/functions/notify-operational-event/index.ts'), 'utf8');
const panel = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/NotificationPreferencesPanel.tsx'), 'utf8');
const inbox = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/WorkspaceNotificationInbox.tsx'), 'utf8');
const driverInbox = fs.readFileSync(path.join(process.cwd(), 'app/driver/_components/DriverNotificationRegister.tsx'), 'utf8');

describe('notification preferences delivery contract', () => {
  it('stores per-user in-app and email choices across canonical event classes', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.user_notification_preferences');
    expect(migration).toContain("event_class IN ('operational','marketplace','finance','account')");
    expect(migration).toContain('user_id = auth.uid()');
    expect(panel).toContain('Operational');
    expect(panel).toContain('Marketplace');
    expect(panel).toContain('Finance');
    expect(panel).toContain('Account');
  });

  it('gates the canonical in-app bridge at database level', () => {
    expect(migration).toContain("fn_notification_channel_enabled(NEW.recipient_user_id, NEW.event_type, 'in_app')");
    expect(migration).toContain("NEW.event_type = 'load_alert'");
    expect(migration).toContain("NEW.payload->>'in_app_enabled'");
  });

  it('gates canonical email delivery in the operational event worker', () => {
    expect(edge).toContain(".from('user_notification_preferences')");
    expect(edge).toContain('userEmailEnabled(userId, event.event_type)');
    expect(edge).toContain('userEmailEnabled(member.user_id, eventType)');
    expect(edge).toContain('event.payload.email_enabled === true && await userEmailEnabled');
  });

  it('exposes preferences in company/broker/customer and driver inboxes without duplicating load-alert push controls', () => {
    expect(inbox).toContain('<NotificationPreferencesPanel />');
    expect(driverInbox).toContain('<NotificationPreferencesPanel driverMode />');
    expect(panel).toContain('Load Alert push notifications are managed separately');
    expect(panel).not.toContain('SMS');
  });
});
