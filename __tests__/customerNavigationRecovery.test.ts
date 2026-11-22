import { describe, expect, it } from 'vitest';
import { composeCustomerPrimaryNav, composeCustomerPrototypeNav } from '../app/components/workspace/TopWorkspaceShell';
import { isCapabilityAllowedForPath } from '../lib/roleCapabilities';

const allLinks = composeCustomerPrimaryNav(composeCustomerPrototypeNav()).flatMap(group => group.items.map(item => item.href));

describe('Customer navigation recovery', () => {
  it('makes post-load, notifications and support reachable', () => {
    for (const href of ['/customer/post-load', '/customer/notifications', '/customer/support']) {
      expect(allLinks, href).toContain(href);
    }
  });
  it('does not expose Fleet to Customer', () => {
    expect(allLinks.some(href => href.includes('/fleet'))).toBe(false);
  });
  it('does not duplicate existing Customer destinations', () => {
    expect(new Set(allLinks).size).toBe(allLinks.length);
  });
});
