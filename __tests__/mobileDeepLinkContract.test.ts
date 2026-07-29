/**
 * Web deep-link contract tests.
 *
 * Verifies that the web launcher surfaces (app/m/page.tsx and
 * app/driver/_components/MobileAppBanner.tsx) emit the same explicit
 * canonical deep-link URI that the Android parser expects, and that
 * the /m route is a launcher/download/fallback surface only.
 *
 * These tests intentionally read source files directly so any future
 * change to the emitted URI fails the test suite immediately.
 */

import { describe, expect, test } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');

function readSource(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf-8');
}

// The one canonical deep-link URI all web launcher surfaces must emit.
const CANONICAL_LAUNCHER_URI = 'xdrivedriver://notification';

// The old bare scheme that must NOT appear in any new link.
const BARE_SCHEME = "xdrivedriver://'";

describe('mobile deep-link contract — web launcher surfaces', () => {
  // ── app/m/page.tsx ──────────────────────────────────────────────────────

  test('app/m/page.tsx emits the explicit canonical destination xdrivedriver://notification', () => {
    const src = readSource('app/m/page.tsx');
    expect(src).toContain(CANONICAL_LAUNCHER_URI);
  });

  test('app/m/page.tsx does not emit the old bare xdrivedriver:// scheme', () => {
    const src = readSource('app/m/page.tsx');
    // The bare scheme (without a path) must not be used as the emitted link.
    expect(src).not.toContain(BARE_SCHEME);
  });

  test('app/m/page.tsx retains a download/APK fallback path', () => {
    const src = readSource('app/m/page.tsx');
    // The /m route must remain a launcher/download surface, not a full app.
    expect(src).toMatch(/get-app|apk|download/i);
  });

  test('app/m/page.tsx retains a web fallback link for users without the app', () => {
    const src = readSource('app/m/page.tsx');
    // Must offer a "Continue on web" or equivalent fallback.
    expect(src).toMatch(/\/driver|web instead|web fallback/i);
  });

  // ── app/driver/_components/MobileAppBanner.tsx ─────────────────────────

  test('MobileAppBanner.tsx emits the explicit canonical destination xdrivedriver://notification', () => {
    const src = readSource('app/driver/_components/MobileAppBanner.tsx');
    expect(src).toContain(CANONICAL_LAUNCHER_URI);
  });

  test('MobileAppBanner.tsx does not emit the old bare xdrivedriver:// scheme', () => {
    const src = readSource('app/driver/_components/MobileAppBanner.tsx');
    expect(src).not.toContain(BARE_SCHEME);
  });

  // ── Shared contract: both surfaces agree on the same canonical URI ──────

  test('both launcher surfaces emit the same canonical deep-link URI', () => {
    const mPage = readSource('app/m/page.tsx');
    const banner = readSource('app/driver/_components/MobileAppBanner.tsx');
    expect(mPage).toContain(CANONICAL_LAUNCHER_URI);
    expect(banner).toContain(CANONICAL_LAUNCHER_URI);
  });

  // ── /m route boundary: must not become a second driver application ───────

  test('app/m/page.tsx does not contain driver operational UI (job list, bids, etc.)', () => {
    const src = readSource('app/m/page.tsx');
    // The /m route is a launcher/download surface; it must not implement
    // driver operational features.
    expect(src).not.toMatch(/jobList|LiveLoads|BidCard|AvailabilityScreen/i);
  });

  test('app/m directory does not contain a full driver dashboard', () => {
    // The /m route tree should only contain launcher, download and fallback pages.
    // Verify no operational driver route files exist under app/m/.
    const { readdirSync: ls, statSync: stat } = { readdirSync, statSync };
    function listFiles(dir: string): string[] {
      try {
        return ls(dir).flatMap((f: string) => {
          const full = join(dir, f);
          return stat(full).isDirectory() ? listFiles(full) : [full];
        });
      } catch {
        return [];
      }
    }
    const mFiles = listFiles(join(ROOT, 'app/m'));
    const operationalPatterns = /dashboard|job-list|bid|availability|finance|document-wallet/i;
    const operational = mFiles.filter(f => operationalPatterns.test(f));
    expect(operational).toHaveLength(0);
  });
});
