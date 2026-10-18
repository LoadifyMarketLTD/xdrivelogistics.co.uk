import { describe, expect, it } from 'vitest';
import { hasWorkspaceCapability } from '../lib/workspaceRole';
import { getCapabilitiesForRole } from '../lib/roleCapabilities';

describe('dispatcher quote decision capability contract', () => {
  it('allows dispatchers to receive, compare and award quotes on company loads', () => {
    expect(hasWorkspaceCapability('dispatcher', 'quotes.receive')).toBe(true);
    expect(hasWorkspaceCapability('dispatcher', 'quotes.compare')).toBe(true);
    expect(hasWorkspaceCapability('dispatcher', 'quotes.award')).toBe(true);

    const caps = getCapabilitiesForRole('company_staff', {
      workspaceRole: 'dispatcher',
      membershipRole: 'dispatcher',
    });
    expect(caps.canReceiveQuotes).toBe(true);
    expect(caps.canAwardJobs).toBe(true);
  });

  it('does not turn a dispatcher into a marketplace bidder', () => {
    expect(hasWorkspaceCapability('dispatcher', 'quotes.submit')).toBe(false);
    const caps = getCapabilitiesForRole('company_staff', {
      workspaceRole: 'dispatcher',
      membershipRole: 'dispatcher',
    });
    expect(caps.canQuoteLoads).toBe(false);
  });
});
