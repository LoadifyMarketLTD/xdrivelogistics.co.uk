import fs from 'node:fs';
import path from 'node:path';

const settingsPage = fs.readFileSync(path.join(process.cwd(), 'app/admin/settings/page.tsx'), 'utf8');
const roleSettings = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/RoleSettingsWorkspace.tsx'), 'utf8');
const inboxPage = fs.readFileSync(path.join(process.cwd(), 'app/admin/notifications/page.tsx'), 'utf8');
const inbox = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/WorkspaceNotificationInbox.tsx'), 'utf8');

describe('current company settings and notification routing contract', () => {
  it('delegates fleet settings to the canonical role settings workspace', () => {
    expect(settingsPage).toContain('<RoleSettingsWorkspace role="fleet" />');
    expect(roleSettings).toContain("notifications: '/admin/notifications'");
  });

  it('routes notification settings to the canonical recipient-scoped inbox', () => {
    expect(inboxPage).toContain('<WorkspaceNotificationInbox role="admin" />');
    expect(inbox).toContain("fetch('/api/workspace/notifications'");
    expect(inbox).toContain("'Load Alerts'");
    expect(inbox).toContain("'Operational'");
  });

  it('does not recreate removed company_settings notification preferences in the settings shell', () => {
    expect(roleSettings).not.toContain("from('company_settings')");
    expect(roleSettings).not.toContain('notify_email_new_job');
    expect(roleSettings).not.toContain('notify_email_bid_received');
  });

  it('keeps granular alert-generation rules explicitly separate from the inbox', () => {
    expect(inbox).toContain('CX-style matching preferences and alert generation remain a separate backend parity item');
  });

  it('does not couple settings or notifications to Super Admin', () => {
    expect(roleSettings).not.toContain('/super-admin');
    expect(inbox).not.toContain('/super-admin');
  });
});
