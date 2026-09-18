import fs from 'node:fs';
import path from 'node:path';

const register = fs.readFileSync(path.join(process.cwd(), 'app/driver/_components/DriverNotificationRegister.tsx'), 'utf8');
const listRoute = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/notifications/route.ts'), 'utf8');
const itemRoute = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/notifications/[id]/route.ts'), 'utf8');
const readRoute = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/notifications/[id]/read/route.ts'), 'utf8');
const readAllRoute = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/notifications/read-all/route.ts'), 'utf8');

describe('CX-close Driver notification inbox', () => {
  it('reads recipient-scoped notifications through the authorised Driver API', () => {
    expect(register).toContain("fetch('/api/driver/notifications'");
    expect(register).not.toContain(".from('notifications')");
    expect(listRoute).toContain(".from('notifications')");
    expect(listRoute).toContain(".eq('user_id', driver.userId)");
    expect(listRoute).toContain('requireWebDriver');
  });

  it('supports unread, load alerts, operational, mark-read, mark-all-read and remove operations', () => {
    expect(register).toContain("type TabId = 'all' | 'unread' | 'load_alerts' | 'operational'");
    expect(register).toContain('Mark all read');
    expect(readRoute).toContain(".eq('user_id', driver.userId)");
    expect(readAllRoute).toContain(".eq('user_id', driver.userId)");
    expect(itemRoute).toContain(".eq('user_id', driver.userId)");
  });
  it('keeps known operational and load-alert categories visible', () => {
    expect(register).toContain("'load_alert'");
    expect(register).toContain("'job_assigned'");
    expect(register).toContain("'bid_accepted'");
    expect(register).toContain("'pod_uploaded'");
    expect(register).toContain("'tracking_eta_alert'");
  });

  it('keeps notification mutation server-side and does not introduce Super Admin coupling', () => {
    expect(register).not.toContain('service_role');
    expect(register).not.toContain('/super-admin');
    expect(readRoute).toContain('requireWebDriver');
    expect(readAllRoute).toContain('requireWebDriver');
    expect(itemRoute).toContain('requireWebDriver');
  });
});
