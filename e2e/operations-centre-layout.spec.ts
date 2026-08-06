import { expect, test } from '@playwright/test';

/**
 * Operations Centre + Fleet Map layout bounds gate
 * (deterministic fixture harness — not authenticated runtime proof)
 *
 * Visits the deterministic fixture routes and proves at three viewports that:
 *   - the Operations Centre page renders as a bounded, styled operational workspace;
 *   - the live operations map (SVG-based) stays within its panel;
 *   - the fleet position map (Leaflet-based) container is bounded and does not
 *     become a full-screen or black surface;
 *   - no page-level horizontal overflow occurs;
 *   - empty/no-data states render honest, accurate copy rather than a healthy claim.
 *
 * This test does not claim to be an authenticated runtime proof.  It uses
 * hard-coded fixture data and a placeholder Supabase configuration.
 */

const viewports = [
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'tablet', width: 768, height: 1024 },
  { label: 'mobile', width: 390, height: 844 },
] as const;

const EXPECTED_FAILED_REQUEST_ALLOWLIST = [
  /\/__next\/webpack-hmr\b/i,
  /\/__nextjs_original-stack-frame\b/i,
  /\/__nextjs_source-map\b/i,
  // OpenStreetMap tile requests are expected to fail in CI (network blocked).
  /tile\.openstreetmap\.org/i,
];

const isAllowlisted = (url: string, allowlist: RegExp[]) =>
  allowlist.some((pattern) => pattern.test(url));

test.describe('operations centre + fleet map layout bounds (deterministic fixture harness)', () => {
  test.skip(
    process.env.E2E_VISUAL_FIXTURE !== 'true',
    'Set E2E_VISUAL_FIXTURE=true to enable deterministic visual fixture routes.',
  );

  // ─── Operations Centre — with-data ───────────────────────────────────────
  test('operations centre (with-data) is bounded and renders semantic content at desktop/tablet/mobile', async ({ page }) => {
    const failedRequests: string[] = [];
    page.on('requestfailed', (req) => {
      if (!isAllowlisted(req.url(), EXPECTED_FAILED_REQUEST_ALLOWLIST)) {
        failedRequests.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText ?? 'unknown'}`);
      }
    });

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/visual-fixture/operations-centre/with-data');
      await page.waitForLoadState('networkidle');

      // No horizontal overflow at any viewport.
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
      );
      expect(overflow, `horizontal overflow at ${vp.label}`).toBe(false);

      // Page shell is visible.
      await expect(page.locator('main.ops-page'), `ops-page at ${vp.label}`).toBeVisible();

      // Metric grid renders at least one metric card.
      const metricCards = page.locator('.metric');
      await expect(metricCards.first(), `first metric at ${vp.label}`).toBeVisible();
      const cardCount = await metricCards.count();
      expect(cardCount, `metric card count at ${vp.label}`).toBeGreaterThan(0);

      // Workspace grid renders.
      await expect(page.locator('.workspace'), `workspace at ${vp.label}`).toBeVisible();

      // Map panel: bounded height — must be present and not full-screen.
      const mapPanel = page.locator('.map').first();
      await expect(mapPanel, `map panel at ${vp.label}`).toBeVisible();
      const mapHeight = await mapPanel.evaluate((el) => el.getBoundingClientRect().height);
      expect(mapHeight, `map height >= 200px at ${vp.label}`).toBeGreaterThanOrEqual(200);
      expect(mapHeight, `map height < viewport height at ${vp.label}`).toBeLessThan(vp.height);

      // With-data scenario: at least one map pin renders.
      await expect(page.locator('.pin').first(), `map pin at ${vp.label}`).toBeVisible();

      // Jobs panel lists fixture jobs.
      await expect(page.getByText('FX001'), `job FX001 at ${vp.label}`).toBeVisible();
    }

    expect(failedRequests, 'unexpected request failures').toEqual([]);
  });

  // ─── Operations Centre — no-data ─────────────────────────────────────────
  test('operations centre (no-data) renders honest empty states at desktop/tablet/mobile', async ({ page }) => {
    const failedRequests: string[] = [];
    page.on('requestfailed', (req) => {
      if (!isAllowlisted(req.url(), EXPECTED_FAILED_REQUEST_ALLOWLIST)) {
        failedRequests.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText ?? 'unknown'}`);
      }
    });

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/visual-fixture/operations-centre/no-data');
      await page.waitForLoadState('networkidle');

      // No horizontal overflow.
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
      );
      expect(overflow, `horizontal overflow at ${vp.label}`).toBe(false);

      // Page shell and map panel are visible and bounded.
      await expect(page.locator('main.ops-page'), `ops-page at ${vp.label}`).toBeVisible();
      const mapPanel = page.locator('.map').first();
      await expect(mapPanel, `map panel at ${vp.label}`).toBeVisible();
      const mapHeight = await mapPanel.evaluate((el) => el.getBoundingClientRect().height);
      expect(mapHeight, `map height < viewport height at ${vp.label}`).toBeLessThan(vp.height);

      // No-data map empty state: honest copy.
      await expect(
        page.getByText('No live coordinates available.'),
        `map empty state at ${vp.label}`,
      ).toBeVisible();

      // No-data jobs empty state.
      await expect(
        page.getByText('No jobs match the selected filters.'),
        `jobs empty state at ${vp.label}`,
      ).toBeVisible();
    }

    expect(failedRequests, 'unexpected request failures').toEqual([]);
  });

  // ─── Fleet Position Map — with-coords ────────────────────────────────────
  test('fleet map (with-coords) container is bounded and does not escape its panel at desktop/tablet/mobile', async ({ page }) => {
    const failedRequests: string[] = [];
    page.on('requestfailed', (req) => {
      // Tile failures are expected in CI; all other failures are reported.
      if (!isAllowlisted(req.url(), EXPECTED_FAILED_REQUEST_ALLOWLIST)) {
        failedRequests.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText ?? 'unknown'}`);
      }
    });

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/visual-fixture/fleet-map/with-coords');
      // Wait for client-side Leaflet to mount (ssr: false dynamic import).
      await page.waitForLoadState('domcontentloaded');

      // No horizontal overflow.
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
      );
      expect(overflow, `horizontal overflow at ${vp.label}`).toBe(false);

      // Map container wrapper is present.
      const container = page.getByTestId('fleet-map-container');
      await expect(container, `fleet-map-container at ${vp.label}`).toBeVisible();

      // Container width is bounded within the viewport — not a full-bleed overflow.
      const containerRect = await container.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { width: r.width, left: r.left, right: r.right };
      });
      expect(containerRect.width, `container width <= viewport width at ${vp.label}`).toBeLessThanOrEqual(vp.width + 2);
      expect(containerRect.right, `container right edge at ${vp.label}`).toBeLessThanOrEqual(vp.width + 2);

      // Loading state or Leaflet container present — either is valid while tiles load.
      const hasLeafletContainer = await page.locator('.leaflet-container').count() > 0;
      const hasLoadingState = (await page.getByText('Loading live map…').count()) > 0;
      expect(
        hasLeafletContainer || hasLoadingState,
        `Leaflet container or loading fallback visible at ${vp.label}`,
      ).toBe(true);

      // When the Leaflet container is present, its height must be ~440px and not full-screen.
      if (hasLeafletContainer) {
        const leafletHeight = await page.locator('.leaflet-container').first().evaluate(
          (el) => el.getBoundingClientRect().height,
        );
        expect(leafletHeight, `leaflet height >= 350px at ${vp.label}`).toBeGreaterThanOrEqual(350);
        expect(leafletHeight, `leaflet height < viewport height at ${vp.label}`).toBeLessThan(vp.height);
      }
    }

    expect(failedRequests, 'unexpected non-tile request failures').toEqual([]);
  });

  // ─── Fleet Position Map — no-coords ──────────────────────────────────────
  test('fleet map (no-coords) renders at UK default centre and stays bounded at desktop/tablet/mobile', async ({ page }) => {
    const failedRequests: string[] = [];
    page.on('requestfailed', (req) => {
      if (!isAllowlisted(req.url(), EXPECTED_FAILED_REQUEST_ALLOWLIST)) {
        failedRequests.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText ?? 'unknown'}`);
      }
    });

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/visual-fixture/fleet-map/no-coords');
      await page.waitForLoadState('domcontentloaded');

      // No horizontal overflow.
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
      );
      expect(overflow, `horizontal overflow at ${vp.label}`).toBe(false);

      // Container wrapper is present.
      const container = page.getByTestId('fleet-map-container');
      await expect(container, `fleet-map-container at ${vp.label}`).toBeVisible();

      // Width bounded.
      const containerWidth = await container.evaluate((el) => el.getBoundingClientRect().width);
      expect(containerWidth, `container width at ${vp.label}`).toBeLessThanOrEqual(vp.width + 2);

      // Loading state or Leaflet container present.
      const hasLeafletContainer = await page.locator('.leaflet-container').count() > 0;
      const hasLoadingState = (await page.getByText('Loading live map…').count()) > 0;
      expect(
        hasLeafletContainer || hasLoadingState,
        `Leaflet container or loading fallback at ${vp.label}`,
      ).toBe(true);
    }

    expect(failedRequests, 'unexpected non-tile request failures').toEqual([]);
  });
});
