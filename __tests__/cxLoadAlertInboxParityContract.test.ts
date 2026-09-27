import fs from 'node:fs';
import path from 'node:path';

const shared = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/WorkspaceNotificationInbox.tsx'), 'utf8');
const driver = fs.readFileSync(path.join(process.cwd(), 'app/driver/_components/DriverNotificationRegister.tsx'), 'utf8');
const sharedApi = fs.readFileSync(path.join(process.cwd(), 'app/api/workspace/notifications/route.ts'), 'utf8');
const driverApi = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/notifications/route.ts'), 'utf8');
const preferences = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/NotificationPreferencesPanel.tsx'), 'utf8');

describe('CX-close load alert inbox parity', () => {
  for (const source of [shared, driver]) {
    it('recognises marketplace and return-journey alert record types', () => {
      expect(source).toContain("'load_alert'");
      expect(source).toContain("'marketplace_load_alert'");
      expect(source).toContain("'nearby_load_alert'");
      expect(source).toContain("'return_journey_alert'");
      expect(source).toContain("'won_load'");
      expect(source).toContain("label: 'Load Alerts'");
    });
  }

  it('uses recipient-scoped inbox/email preferences while keeping Driver Load Alert push preferences separate', () => {
    expect(shared).toContain('<NotificationPreferencesPanel />');
    expect(driver).toContain('<NotificationPreferencesPanel driverMode />');
    expect(preferences).toContain("from('user_notification_preferences')");
    expect(preferences).toContain('Load Alert push notifications are managed separately');
  });

  it('keeps recipient scoping on both inboxes', () => {
    expect(shared).toContain("fetch('/api/workspace/notifications'");
    expect(driver).toContain("fetch('/api/driver/notifications'");
    expect(sharedApi).toContain(".eq('user_id', user.id)");
    expect(driverApi).toContain(".eq('user_id', driver.userId)");
  });

  it('does not touch Super Admin', () => {
    expect(shared).not.toContain('/super-admin');
    expect(driver).not.toContain('/super-admin');
  });
});
