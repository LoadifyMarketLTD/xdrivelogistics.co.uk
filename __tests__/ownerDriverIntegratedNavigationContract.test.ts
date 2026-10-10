import { describe, expect, it } from 'vitest';
import { composeDriverPrimaryNav } from '../app/components/workspace/TopWorkspaceShell';
import { getVisibleWorkspaceNav, hasWorkspaceCapability } from '../lib/workspaceRole';

const hrefs = (groups: Array<{ items: Array<{ href: string }> }>) =>
  groups.flatMap((group) => group.items.map((item) => item.href));

describe('owner-driver sole-trader navigation contract', () => {
  it('keeps a focused primary navigation and a compact More bucket', () => {
    const nav = composeDriverPrimaryNav(getVisibleWorkspaceNav('owner_driver'), true);
    expect(nav.map((group) => group.label)).toEqual([
      'Dashboard',
      'Loads',
      'Quotes',
      'My Jobs',
      'Diary',
      'Availability',
      'Return Journeys',
      'Directory',
      'More',
    ]);

    const more = nav.find((group) => group.id === 'owner-driver-more');
    expect(more?.items.map((item) => item.label)).toEqual([
      'Load Alerts',
      "Who's Nearby",
      'Messages',
      'My Vehicle',
      'Finance',
      'Documents',
      'Membership & Billing',
      'Account / Settings',
    ]);
  });

  it('does not expose fleet administration in the owner-driver shell', () => {
    const visible = hrefs(composeDriverPrimaryNav(getVisibleWorkspaceNav('owner_driver'), true));
    for (const forbidden of ['/driver/availability/live', '/driver/drivers-vehicles', '/driver/drivers']) {
      expect(visible).not.toContain(forbidden);
    }
    expect(hasWorkspaceCapability('owner_driver', 'drivers.manage')).toBe(false);
    expect(hasWorkspaceCapability('owner_driver', 'company.members.manage')).toBe(false);
  });
});
