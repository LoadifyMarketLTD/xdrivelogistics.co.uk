import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getVisibleWorkspaceNav } from '../lib/workspaceRole';

const shell = fs.readFileSync(path.join(process.cwd(), 'app/driver/_components/DriverWorkspaceShell.tsx'), 'utf8');
const nearby = fs.readFileSync(path.join(process.cwd(), 'app/driver/nearby/page.tsx'), 'utf8');

describe('CX-informed Driver Live Availability route contract', () => {
  it('separates exchange Live Availability from the driver own-status editor', () => {
    const items = getVisibleWorkspaceNav('driver').flatMap((group) => group.items);
    expect(items).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Live Availability', href: '/driver/nearby' }),
      expect.objectContaining({ label: 'My Availability', href: '/driver/availability' }),
    ]));
  });

  it('labels each route by its real purpose instead of presenting two different pages as the same feature', () => {
    expect(shell).toContain("'/driver/nearby': 'Live Availability'");
    expect(shell).toContain("'/driver/availability': 'My Availability'");
    expect(shell).toContain("'/driver/availability/live': 'Share Availability'");
  });

  it('keeps the CX-style exchange surface wired to real exchange-visible positions, map/list views and future journeys', () => {
    expect(nearby).toContain('/api/availability/nearby');
    expect(nearby).toContain("position.scope === 'exchange'");
    expect(nearby).toContain('Map View');
    expect(nearby).toContain('List View');
    expect(nearby).toContain("router.push('/driver/returns')");
    expect(nearby).toContain('LiveAvailabilityMap');
    expect(nearby).toContain('My Availability');
    expect(nearby).toContain('Message');
    expect(nearby).toContain('Book Direct');
    expect(nearby).toContain("hasWorkspaceCapability(workspaceRole, 'loads.create')");
    expect(nearby).toContain('/driver/post-load?directCarrier=');
  });
});
