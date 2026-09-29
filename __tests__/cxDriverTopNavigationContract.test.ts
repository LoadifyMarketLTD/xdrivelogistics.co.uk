import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const shell = fs.readFileSync(path.join(process.cwd(), 'app/driver/_components/DriverTopWorkspaceShell.tsx'), 'utf8');
const notificationsApi = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/notifications/route.ts'), 'utf8');

describe('Driver top navigation role split', () => {
  it('keeps employed Driver navigation execution-first', () => {
    for (const label of ['Today','My Jobs','Diary','Availability','Vehicle']) {
      expect(shell).toContain("label: '" + label + "'");
    }
    expect(shell).toContain("const DRIVER_COMMERCIAL_NAV_IDS = new Set(['directory', 'nearby', 'returns', 'loads', 'quotes', 'won-work', 'vision'])");
  });

  it('keeps commercial tools behind owner-driver or explicit commercial authority', () => {
    expect(shell).toContain("const commercialAccess = role === 'owner_driver' || user?.canCommercialBid === true");
    for (const href of ['/driver/directory','/driver/nearby','/driver/returns','/driver/loads','/driver/quotes','/driver/won-work']) {
      expect(shell).toContain("href: '" + href + "'");
    }
    expect(shell).toContain('label: "Who\'s Nearby"');
  });

  it('keeps finance and staff controls owner-only', () => {
    expect(shell).toContain("const DRIVER_OWNER_ONLY_NAV_IDS = new Set(['load-alerts', 'finance', 'drivers'])");
    expect(shell).toContain("{role === 'owner_driver' && <button");
    expect(shell).toContain('ownerOnly: true');
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
