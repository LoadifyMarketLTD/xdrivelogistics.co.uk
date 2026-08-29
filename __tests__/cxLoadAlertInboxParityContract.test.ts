import fs from 'node:fs';
import path from 'node:path';

const shared = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/WorkspaceNotificationInbox.tsx'), 'utf8');
const driver = fs.readFileSync(path.join(process.cwd(), 'app/driver/_components/DriverNotificationRegister.tsx'), 'utf8');

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

  it('does not claim alert generation/preferences are complete when the backend contract is not yet present', () => {
    expect(shared).toContain('separate backend parity item');
    expect(driver).toContain('separate backend parity item');
  });

  it('keeps recipient scoping on both inboxes', () => {
    expect(shared).toContain(".eq('user_id', user.id)");
    expect(driver).toContain(".eq('user_id', user.id)");
  });

  it('does not touch Super Admin', () => {
    expect(shared).not.toContain('/super-admin');
    expect(driver).not.toContain('/super-admin');
  });
});
