import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));
import { getResponsivePostLoginRoute } from '../lib/authSession';

const driver = {
  role: 'driver' as const,
  workspaceRole: 'owner_driver' as const,
  ownerDriverWorkspace: true,
  canAccessDriverMode: true,
  ownerDriverExecutionMode: false,
  mustChangePassword: false,
};

describe('Driver device-aware post-login routing', () => {
  it('opens desktop workspace on desktop and official PWA on mobile', () => {
    expect(getResponsivePostLoginRoute(driver, false)).toBe('/driver/jobs');
    expect(getResponsivePostLoginRoute(driver, true)).toBe('/driver/official-pwa-live');
  });
  it('routes company drivers to the correct surface', () => {
    const companyDriver = { ...driver, workspaceRole: 'driver' as const, ownerDriverWorkspace: false };
    expect(getResponsivePostLoginRoute(companyDriver, false)).toBe('/driver/jobs');
    expect(getResponsivePostLoginRoute(companyDriver, true)).toBe('/driver/official-pwa-live');
  });
  it('does not bypass mandatory password change', () => {
    expect(getResponsivePostLoginRoute({ ...driver, mustChangePassword: true }, true)).toBe('/driver/change-password');
  });
  it('preserves the company workspace for non-driver roles', () => {
    expect(getResponsivePostLoginRoute({ ...driver, role: 'company_admin', workspaceRole: 'company_owner', ownerDriverWorkspace: false }, false)).not.toBe('/driver/official-pwa-live');
  });
});
