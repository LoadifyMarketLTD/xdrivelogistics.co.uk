import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Driver workspace navigation performance contract', () => {
  it('prefetches only the route the user is approaching instead of bulk-prefetching the navbar', () => {
    const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
    expect(shell).toContain('router.prefetch(href)');
    expect(shell).toContain('onPointerEnter={() => prefetchRoute(item.href)}');
    expect(shell).toContain('onFocus={() => prefetchRoute(item.href)}');
    expect(shell).not.toContain('primaryPrefetchHrefs');
    expect(shell).not.toContain('450 + index * 220');
  });

  it('does not reacquire the Supabase auth Web Lock on primary Owner Driver surfaces', () => {
    const files = [
      'app/components/workspace/TopWorkspaceShell.tsx',
      'app/components/workspace/MemberDirectoryPage.tsx',
      'app/components/workspace/usePrivateNetworkGroups.ts',
      'app/components/workspace/PendingBookingOffers.tsx',
      'app/driver/page.tsx',
      'app/driver/action-centre/page.tsx',
      'app/driver/availability/live/page.tsx',
      'app/driver/availability/page.tsx',
      'app/driver/vehicles/page.tsx',
      'app/driver/returns/page.tsx',
      'app/driver/loads/page.tsx',
      'app/driver/quotes/page.tsx',
      'app/driver/history/page.tsx',
      'app/driver/won-work/page.tsx',
      'app/driver/load-alerts/page.tsx',
      'app/driver/nearby/page.tsx',
      'app/driver/documents/page.tsx',
      'app/driver/finance/page.tsx',
      'app/driver/messages/page.tsx',
      'app/driver/freight-vision/page.tsx',
    ];

    for (const file of files) {
      expect(read(file), file).not.toContain('supabase.auth.getSession()');
    }
  });

  it('keeps live operational polling useful without a 10-second request loop', () => {
    for (const file of [
      'app/driver/loads/page.tsx',
      'app/driver/quotes/page.tsx',
      'app/driver/history/page.tsx',
    ]) {
      const source = read(file);
      expect(source, file).toContain('intervalMs: 30_000');
      expect(source, file).not.toContain('intervalMs: 10_000');
    }
  });

  it('reads the already-synchronized protected-route token for API headers', () => {
    const authCookie = read('lib/routeAuthCookie.ts');
    expect(authCookie).toContain('export const readRouteAuthAccessToken');
    expect(authCookie).toContain('export const readRouteAuthHeader');
  });
});
