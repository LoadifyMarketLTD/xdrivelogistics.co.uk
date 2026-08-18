import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getProtectedRouteRequirement } from '../lib/roleCapabilities';

const routes = [
  '/admin/action-centre',
  '/broker/action-centre',
  '/customer/action-centre',
  '/driver/action-centre',
] as const;

const pagePath = (href: string) => resolve(process.cwd(), 'app', href.replace(/^\//, ''), 'page.tsx');

describe('Action Centre route registry', () => {
  it.each(routes)('registers %s in the protected route guard', (href) => {
    expect(getProtectedRouteRequirement(href), `${href} is not registered`).not.toBeNull();
  });

  it.each(routes)('backs %s with a real page', (href) => {
    expect(existsSync(pagePath(href)), `${href} has no page.tsx`).toBe(true);
  });
});
