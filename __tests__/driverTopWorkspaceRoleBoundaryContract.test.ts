import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Driver top workspace role boundary', () => {
  const shell = fs.readFileSync(
    path.join(process.cwd(), 'app/driver/_components/DriverTopWorkspaceShell.tsx'),
    'utf8',
  );

  it('keeps owner-only finance, staff, billing and post-load controls out of fleet-employed UI', () => {
    expect(shell).toContain("const DRIVER_OWNER_ONLY_NAV_IDS = new Set(['finance', 'drivers'])");
    expect(shell).toContain("ownerOnly: true");
    expect(shell).toContain("role === 'owner_driver' && <button type=\"button\" className=\"cta post\"");
    expect(shell).toContain("DRIVER_OWNER_ONLY_NAV_IDS.has(item.id)");
    expect(shell).toContain("role === 'owner_driver' || !('ownerOnly' in item && item.ownerOnly === true)");
  });

  it('shows commercial discovery controls only to owner drivers or explicitly authorised company drivers', () => {
    expect(shell).toContain("const commercialAccess = role === 'owner_driver' || user?.canCommercialBid === true");
    expect(shell).toContain("const DRIVER_COMMERCIAL_NAV_IDS = new Set(['directory', 'availability', 'returns', 'loads', 'quotes'])");
    expect(shell).toContain("{commercialAccess && <button type=\"button\" className=\"cta direct\"");
  });

  it('gives an employed driver personal profile, vehicle, documents, notifications, security and audit links', () => {
    expect(shell).toContain("{ label: 'My Profile', href: '/driver/profile' }");
    expect(shell).toContain("{ label: 'Vehicle', href: '/driver/vehicles' }");
    expect(shell).toContain("{ label: 'Documents', href: '/driver/documents' }");
    expect(shell).toContain("{ label: 'Notifications', href: '/driver/notifications' }");
    expect(shell).toContain("{ label: 'Security', href: '/driver/change-password' }");
    expect(shell).toContain("{ label: 'Audit / Event Log', href: '/driver/event-log' }");
  });
});
