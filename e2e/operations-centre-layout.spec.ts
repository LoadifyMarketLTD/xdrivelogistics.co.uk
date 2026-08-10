import { expect, test, type Page, type TestInfo } from '@playwright/test';

/**
 * Fleet Map layout and degraded-state gate.
 * Deterministic fixture harness only — not authenticated runtime proof.
 */

const viewports = [
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'tablet', width: 768, height: 1024 },
  { label: 'mobile', width: 390, height: 844 },
] as const;

const OSM_TILE_HOSTS = new Set([
  'tile.openstreetmap.org',
  'a.tile.openstreetmap.org',
  'b.tile.openstreetmap.org',
  'c.tile.openstreetmap.org',
]);

const isOsmTileRequest = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && OSM_TILE_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
};

const EXPECTED_FAILED_REQUEST_PATTERNS = [
  /\/__next\/webpack-hmr\b/i,
  /\/__nextjs_original-stack-frame\b/i,
  /\/__nextjs_source-map\b/i,
];

const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

const collectUnexpectedFailures = (page: Page, allowOsmFailures = false) => {
  const failures: string[] = [];
  page.on('requestfailed', (request) => {
    const url = request.url();
    const errorText = request.failure()?.errorText ?? 'unknown';
    if (allowOsmFailures && isOsmTileRequest(url)) return;
    // Leaflet cancels obsolete tile requests when fitBounds/setView changes the
    // viewport. These OSM-only ERR_ABORTED events are expected and do not mean
    // the active tile layer failed; real OSM/network failures remain visible.
    if (isOsmTileRequest(url) && /ERR_ABORTED/i.test(errorText)) return;
    if (EXPECTED_FAILED_REQUEST_PATTERNS.some((pattern) => pattern.test(url))) return;
    failures.push(`${request.method()} ${url} :: ${errorText}`);
  });
  return failures;
};

const stubOsmTiles = async (page: Page) => {
  await page.route('**/*', async (route) => {
    if (!isOsmTileRequest(route.request().url())) {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: TRANSPARENT_PNG,
    });
  });
};

const blockOsmTiles = async (page: Page) => {
  await page.route('**/*', async (route) => {
    if (!isOsmTileRequest(route.request().url())) {
      await route.continue();
      return;
    }

    await route.abort('failed');
  });
};

const assertNoHorizontalOverflow = async (page: Page, label: string) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  expect(overflow, `horizontal overflow at ${label}`).toBe(false);
};

const assertFleetContainerBounds = async (
  page: Page,
  viewport: { label: string; width: number; height: number },
) => {
  const container = page.getByTestId('fleet-map-container');
  await expect(container, `fleet-map-container at ${viewport.label}`).toBeVisible();

  const rect = await container.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      width: bounds.width,
      right: bounds.right,
      height: bounds.height,
    };
  });

  expect(rect.width, `container width at ${viewport.label}`).toBeLessThanOrEqual(viewport.width + 2);
  expect(rect.right, `container right edge at ${viewport.label}`).toBeLessThanOrEqual(viewport.width + 2);
  expect(rect.height, `container height at ${viewport.label}`).toBeGreaterThanOrEqual(350);
  expect(rect.height, `container height below viewport at ${viewport.label}`).toBeLessThan(viewport.height);
};

const attachScreenshot = async (page: Page, testInfo: TestInfo, name: string) => {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
};

test.describe('fleet map deterministic runtime proof', () => {
  test.describe.configure({ retries: 0 });

  test.skip(
    process.env.E2E_VISUAL_FIXTURE !== 'true',
    'Set E2E_VISUAL_FIXTURE=true to enable deterministic visual fixture routes.',
  );

  for (const viewport of viewports) {
    test(`fleet map with-coords reaches a stable ready state at ${viewport.label}`, async ({ page }, testInfo) => {
      const failures = collectUnexpectedFailures(page);
      await stubOsmTiles(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/visual-fixture/fleet-map/with-coords', { waitUntil: 'domcontentloaded' });

      await assertNoHorizontalOverflow(page, viewport.label);
      await expect(page.getByTestId('fleet-map-ready')).toBeVisible();
      await expect(page.locator('.leaflet-container')).toBeVisible();
      await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible();
      await expect(page.getByTestId('fleet-map-provider-error')).toHaveCount(0);
      await assertFleetContainerBounds(page, viewport);

      await attachScreenshot(page, testInfo, `fleet-with-coords-${viewport.label}`);
      expect(failures, 'unexpected request failures').toEqual([]);
    });

    test(`fleet map provider-error is explicit and bounded at ${viewport.label}`, async ({ page }, testInfo) => {
      const failures = collectUnexpectedFailures(page, true);
      await blockOsmTiles(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/visual-fixture/fleet-map/provider-error', { waitUntil: 'domcontentloaded' });

      await assertNoHorizontalOverflow(page, viewport.label);
      await expect(page.getByTestId('fleet-map-ready')).toBeVisible();
      await expect(page.locator('.leaflet-container')).toBeVisible();
      await expect(page.getByTestId('fleet-map-provider-error')).toContainText(
        'Map tiles are temporarily unavailable.',
      );
      await assertFleetContainerBounds(page, viewport);

      await attachScreenshot(page, testInfo, `fleet-provider-error-${viewport.label}`);
      expect(failures, 'unexpected non-tile request failures').toEqual([]);
    });

    test(`fleet map no-coords renders an explicit empty state at ${viewport.label}`, async ({ page }, testInfo) => {
      const failures = collectUnexpectedFailures(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/visual-fixture/fleet-map/no-coords', { waitUntil: 'domcontentloaded' });

      await assertNoHorizontalOverflow(page, viewport.label);
      await expect(page.getByTestId('fleet-map-no-coords')).toContainText(
        'No live fleet positions available.',
      );
      await expect(page.locator('.leaflet-container')).toHaveCount(0);
      await assertFleetContainerBounds(page, viewport);

      await attachScreenshot(page, testInfo, `fleet-no-coords-${viewport.label}`);
      expect(failures, 'unexpected request failures').toEqual([]);
    });

    test(`fleet map rejects invalid coordinates at ${viewport.label}`, async ({ page }, testInfo) => {
      const failures = collectUnexpectedFailures(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/visual-fixture/fleet-map/invalid-coords', { waitUntil: 'domcontentloaded' });

      await assertNoHorizontalOverflow(page, viewport.label);
      await expect(page.getByTestId('fleet-map-no-coords')).toContainText(
        'No live fleet positions available.',
      );
      await expect(page.locator('.leaflet-container')).toHaveCount(0);
      await assertFleetContainerBounds(page, viewport);

      await attachScreenshot(page, testInfo, `fleet-invalid-coords-${viewport.label}`);
      expect(failures, 'unexpected request failures').toEqual([]);
    });
  }
});
