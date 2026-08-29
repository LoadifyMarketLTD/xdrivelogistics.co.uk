import fs from 'node:fs';
import path from 'node:path';

const register = fs.readFileSync(path.join(process.cwd(), 'app/driver/_components/DriverNotificationRegister.tsx'), 'utf8');
const migration = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260826094600_notification_inbox_bridge_reconciliation.sql'), 'utf8');

describe('CX-close Driver notification inbox', () => {
  it('reads the recipient-scoped notifications inbox rather than delivery queue state', () => {
    expect(register).toContain(".from('notifications')");
    expect(register).toContain(".eq('user_id', user.id)");
    expect(register).toContain('read_at');
    expect(register).not.toContain(".from('notification_events')");
  });

  it('supports unread, mark-read, mark-all-read and remove operations', () => {
    expect(register).toContain("type TabId = 'all' | 'unread' | 'operational'");
    expect(register).toContain(".update({ read_at: readAt })");
    expect(register).toContain(".is('read_at', null)");
    expect(register).toContain('.delete()');
    expect(register).toContain('Mark all read');
  });

  it('relies on the existing recipient-scoped inbox contract and does not alter DB policy here', () => {
    expect(migration).toContain('Production already has working recipient-scoped SELECT/UPDATE/DELETE policies');
    expect(register).not.toContain('service_role');
  });

  it('keeps known operational event categories visible without fabricating Load Alerts', () => {
    expect(register).toContain("'job_assigned'");
    expect(register).toContain("'bid_accepted'");
    expect(register).toContain("'pod_uploaded'");
    expect(register).toContain("'tracking_eta_alert'");
    expect(register).not.toContain("'load_alert'");
  });

  it('does not introduce Super Admin coupling', () => {
    expect(register).not.toContain('/super-admin');
  });
});
