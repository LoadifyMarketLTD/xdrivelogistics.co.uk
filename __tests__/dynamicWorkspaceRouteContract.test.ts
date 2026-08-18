import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getProtectedRouteRequirement } from '../lib/roleCapabilities';

const routes = [
  { href: '/admin/freight-vision', capability: 'jobs.track' },
  { href: '/admin/live-availability', capability: 'fleet.positions.view' },
  { href: '/admin/fleet/resources', capability: 'fleet.positions.view' },
] as const;

const pagePath = (href: string) => resolve(process.cwd(), 'app', href.replace(/^\//, ''), 'page.tsx');

describe('dynamic operational shell routes', () => {
  it.each(routes)('registers $href consistently with its shell capability', ({ href, capability }) => {
    const requirement = getProtectedRouteRequirement(href);
    expect(requirement, `${href} is not registered`).not.toBeNull();
    expect(requirement?.anyOf).toContain(capability);
  });

  it.each(routes)('backs $href with a real page', ({ href }) => {
    expect(existsSync(pagePath(href)), `${href} has no page.tsx`).toBe(true);
  });
});
