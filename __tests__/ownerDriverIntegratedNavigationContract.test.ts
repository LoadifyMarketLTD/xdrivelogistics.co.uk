import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { composeDriverPrimaryNav } from '../app/components/workspace/TopWorkspaceShell';
import { getVisibleWorkspaceNav } from '../lib/workspaceRole';

describe('owner-driver navigation integration contract', () => {
  it('removes the generic More bucket from the owner-driver primary shell', () => {
    const nav = composeDriverPrimaryNav(getVisibleWorkspaceNav('owner_driver'), true);
    expect(nav.some((group) => group.id === 'owner-driver-more')).toBe(false);
    expect(nav.some((group) => group.label === 'More')).toBe(false);
  });

  it('integrates former More routes into their parent workspaces', () => {
    const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

    expect(read('app/driver/action-centre/page.tsx')).toContain("href: '/driver/messages'");
    expect(read('app/driver/messages/page.tsx')).toContain("href: '/driver/action-centre'");

    expect(read('app/driver/availability/page.tsx')).toContain("href: '/driver/availability/live'");
    expect(read('app/driver/availability/page.tsx')).toContain("href: '/driver/nearby'");
    expect(read('app/driver/availability/live/page.tsx')).toContain("router.push('/driver/nearby')");
    expect(read('app/driver/nearby/page.tsx')).toContain("href: '/driver/availability'");

    expect(read('app/driver/loads/page.tsx')).toContain("router.push('/driver/load-alerts')");
    expect(read('app/driver/load-alerts/page.tsx')).toContain("href: '/driver/loads'");

    expect(read('app/driver/quotes/page.tsx')).toContain("href: '/driver/won-work'");
    expect(read('app/driver/won-work/page.tsx')).toContain("href: '/driver/quotes'");

    expect(read('app/driver/history/page.tsx')).toContain("href: '/driver/jobs'");
    expect(read('app/driver/jobs/page.tsx')).toContain("href: '/driver/history'");

    expect(read('app/driver/drivers-vehicles/page.tsx')).toContain("onClick={() => router.push('/driver/documents')}");
    expect(read('app/driver/documents/page.tsx')).toContain("href: '/driver/drivers-vehicles'");
  });
});
