import { describe, expect, it } from 'vitest';
import { getProtectedRouteRequirement } from '../lib/roleCapabilities';

describe('driver auxiliary route contracts', () => {
  it('registers the existing Driver account route and nested profile route', () => {
    expect(getProtectedRouteRequirement('/driver/account')?.prefix).toBe('/driver/account');
    expect(getProtectedRouteRequirement('/driver/account/profile')?.prefix).toBe('/driver/account');
  });

  it('registers existing Driver Event Log and Action Centre routes', () => {
    expect(getProtectedRouteRequirement('/driver/event-log')?.prefix).toBe('/driver/event-log');
    expect(getProtectedRouteRequirement('/driver/action-centre')?.prefix).toBe('/driver/action-centre');
  });
});
