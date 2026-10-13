import { describe, expect, it } from 'vitest';
import { getVisibleWorkspaceNav, type WorkspaceRole } from '../lib/workspaceRole';

const DIARY_ROLES: WorkspaceRole[] = [
  'company_owner',
  'company_admin',
  'carrier_admin',
  'broker',
  'customer',
  'fleet_manager',
  'dispatcher',
  'driver',
  'owner_driver',
  'finance',
  'viewer',
];

describe('Diary is available across every operational job-history workspace', () => {
  for (const role of DIARY_ROLES) {
    it(`${role} exposes Diary in workspace navigation`, () => {
      const items = getVisibleWorkspaceNav(role).flatMap((group) => group.items);
      const diary = items.find((item) => item.label === 'Diary');
      expect(diary, `${role} Diary nav item`).toBeTruthy();
      expect(diary?.href).toMatch(/^\/(admin|broker|customer|driver)\/(diary|history)$/);
    });
  }

  it('keeps Super Admin outside the shared Diary change', () => {
    expect(getVisibleWorkspaceNav('platform_owner')).toEqual([]);
  });
});
