import { describe, expect, it } from 'vitest';
import { getWorkspaceHomeRoute } from '../lib/workspaceRole';

describe('official driver PWA canonical login destination', () => {
  it('routes owner-driver accounts to the integrated PWA', () => {
    expect(getWorkspaceHomeRoute({ role: 'driver', rawRole: 'driver', membershipRole: 'owner', ownerDriverWorkspace: true })).toBe('/driver/official-pwa-live');
  });
  it('routes ordinary company driver accounts to the integrated PWA', () => {
    expect(getWorkspaceHomeRoute({ role: 'driver', rawRole: 'driver', ownerDriverWorkspace: false })).toBe('/driver/official-pwa-live');
  });
  it('does not redirect a customer account into driver mode', () => {
    expect(getWorkspaceHomeRoute({ role: 'customer', rawRole: 'customer' })).not.toContain('/driver/official-pwa-live');
  });
});
