import fs from 'node:fs';
import path from 'node:path';

const inbox = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/WorkspaceNotificationInbox.tsx'), 'utf8');
const admin = fs.readFileSync(path.join(process.cwd(), 'app/admin/notifications/page.tsx'), 'utf8');
const broker = fs.readFileSync(path.join(process.cwd(), 'app/broker/notifications/page.tsx'), 'utf8');
const customer = fs.readFileSync(path.join(process.cwd(), 'app/customer/notifications/page.tsx'), 'utf8');

describe('CX-close workspace notification inbox', () => {
  it('uses the recipient-scoped inbox and real read state', () => {
    expect(inbox).toContain(".from('notifications')");
    expect(inbox).toContain(".eq('user_id', user.id)");
    expect(inbox).toContain('read_at');
    expect(inbox).not.toContain(".from('notification_events')");
  });

  it('supports unread filtering and inbox maintenance actions', () => {
    expect(inbox).toContain("type InboxTab = 'all' | 'unread' | 'operational'");
    expect(inbox).toContain(".update({ read_at: readAt })");
    expect(inbox).toContain(".is('read_at', null)");
    expect(inbox).toContain('.delete()');
    expect(inbox).toContain('Mark all read');
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

  it('does not fabricate a Load Alert event type or couple to Super Admin', () => {
    expect(inbox).not.toContain("'load_alert'");
    expect(inbox).not.toContain('/super-admin');
  });
});
