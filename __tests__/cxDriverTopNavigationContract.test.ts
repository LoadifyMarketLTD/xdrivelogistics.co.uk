import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const shell = fs.readFileSync(path.join(process.cwd(), 'app/driver/_components/DriverTopWorkspaceShell.tsx'), 'utf8');
const prototypeCss = fs.readFileSync(path.join(process.cwd(), 'app/driver/driver-full-prototype.css'), 'utf8');
const notificationsApi = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/notifications/route.ts'), 'utf8');

describe('approved prototype Driver top navigation', () => {
  it('uses the complete approved prototype module order', () => {
    const labels = ['Dashboard','My Jobs','Availability',"Who's Nearby",'Directory','My Fleet','Return Journeys','Loads','Quotes','Diary','Freight Vision','Finance','Drivers & Vehicles'];
    let previous = -1;
    for (const label of labels) {
      const singleQuoted = shell.indexOf(`label: '${label}'`);
      const doubleQuoted = shell.indexOf(`label: \"${label}\"`);
      const current = Math.max(singleQuoted, doubleQuoted);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
  });

  it('maps prototype modules to real Driver routes', () => {
    for (const href of ['/driver','/driver/jobs','/driver/availability','/driver/nearby','/driver/directory','/driver/vehicles','/driver/returns','/driver/loads','/driver/quotes','/driver/history','/driver/freight-vision','/driver/finance','/driver/drivers-vehicles']) {
      expect(shell).toContain(`href: '${href}'`);
    }
  });
  it('keeps the approved topbar while permanently removing the blue side rail', () => {
    expect(shell).toContain('topbar');
    expect(shell).toContain('main-nav');
    expect(shell).not.toContain('global-rail');
    expect(shell).not.toContain('DRIVER_MORE_NAV');
    expect(shell).not.toContain('driver-top-nav__more-trigger');
    expect(prototypeCss).toContain('.driver-prototype-port .topbar');
    expect(prototypeCss).not.toContain('.driver-prototype-port .global-rail');
  });

  it('moves the existing settings functions into the top Settings button', () => {
    for (const label of ['Overview','My Profile','Company Profile','Drivers / Staff','Vehicle','Documents','Billing & Membership','Notifications','Security','Audit / Event Log','Support']) {
      expect(shell.includes(`label: '${label}'`) || shell.includes(`label: \"${label}\"`)).toBe(true);
    }
    expect(shell).toContain('driver-settings-menu');
    expect(shell).toContain('driver-settings-menu__panel');
    expect(shell).toContain("'/driver/settings?section=overview'");
    expect(shell).toContain("'/driver/change-password'");
  });

  it('keeps real notification inbox counting', () => {
    expect(shell).toContain("fetch('/api/driver/notifications'");
    expect(shell).not.toContain(".from('notifications')");
    expect(notificationsApi).toContain(".eq('user_id', driver.userId)");
  });

  it('does not introduce Super Admin coupling', () => {
    expect(shell).not.toContain('/super-admin');
  });
});
