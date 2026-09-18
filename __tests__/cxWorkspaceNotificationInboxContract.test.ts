import fs from 'node:fs';
import path from 'node:path';

const inbox = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/WorkspaceNotificationInbox.tsx'), 'utf8');
const route = fs.readFileSync(path.join(process.cwd(), 'app/api/workspace/notifications/route.ts'), 'utf8');
const itemRoute = fs.readFileSync(path.join(process.cwd(), 'app/api/workspace/notifications/[id]/route.ts'), 'utf8');
const admin = fs.readFileSync(path.join(process.cwd(), 'app/admin/notifications/page.tsx'), 'utf8');
const broker = fs.readFileSync(path.join(process.cwd(), 'app/broker/notifications/page.tsx'), 'utf8');
const customer = fs.readFileSync(path.join(process.cwd(), 'app/customer/notifications/page.tsx'), 'utf8');

describe('CX-close workspace notification inbox', () => {
  it('uses server-authoritative recipient-scoped inbox state', () => {
    expect(inbox).toContain("fetch('/api/workspace/notifications'");
    expect(inbox).not.toContain(".from('notifications')");
    expect(route).toContain(".from('notifications')");
    expect(route).toContain(".eq('user_id', user.id)");
    expect(route).toContain('read_at');
  });

  it('supports unread, load-alert, operational and maintenance actions', () => {
    expect(inbox).toContain("type InboxTab = 'all' | 'unread' | 'load_alerts' | 'operational'");
    expect(inbox).toContain('Mark all read');
    expect(inbox).toContain("method: 'PATCH'");
    expect(inbox).toContain("method: 'DELETE'");
    expect(route).toContain("body?.action !== 'read_all'");
    expect(itemRoute).toContain(".eq('user_id', user.id)");
  });
  it('is shared by Admin, Broker and Customer without changing permissions', () => {
    expect(admin).toContain('<WorkspaceNotificationInbox role="admin"');
    expect(broker).toContain('<WorkspaceNotificationInbox role="broker"');
    expect(customer).toContain('<WorkspaceNotificationInbox role="customer"');
  });

  it('routes notification context through existing role-scoped navigation', () => {
    expect(inbox).toContain('resolveRoleScopedHref');
    expect(inbox).toContain('getActionCentreRoute');
  });

  it('keeps real load-alert and operational event categories without Super Admin coupling', () => {
    expect(inbox).toContain("'load_alert'");
    expect(inbox).toContain("'job_assigned'");
    expect(inbox).toContain("'tracking_eta_alert'");
    expect(inbox).not.toContain('/super-admin');
  });
});
