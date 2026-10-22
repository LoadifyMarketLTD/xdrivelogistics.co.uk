import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

test('Driver PWA serves its scoped manifest, icons and privacy-first worker', async ({ request }) => {
  const manifestResponse = await request.get('/xdrive-driver.webmanifest');
  expect(manifestResponse.status()).toBe(200);
  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe('XDrive Driver');
  expect(manifest.start_url).toBe('/m/driver/jobs');
  expect(manifest.scope).toBe('/m/driver/');
  expect(manifest.display).toBe('standalone');

  for (const icon of manifest.icons as Array<{ src: string }>) {
    const response = await request.get(icon.src);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
  }

  const workerResponse = await request.get('/driver-pwa-sw.js');
  expect(workerResponse.status()).toBe(200);
  const source = await workerResponse.text();
  expect(source).toContain("request.mode !== 'navigate'");
  expect(source).not.toContain('caches.open(');
  expect(source).not.toContain('cache.put(');
});

test('Driver service worker can register with its restricted navigation scope', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  const info = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.register('/driver-pwa-sw.js', {
      scope: '/m/driver/',
      updateViaCache: 'none',
    });
    return {
      scopePath: new URL(registration.scope).pathname,
      scriptPath: new URL(registration.installing?.scriptURL ||
        registration.waiting?.scriptURL || registration.active?.scriptURL || '').pathname,
    };
  });
  expect(info.scopePath).toBe('/m/driver/');
  expect(info.scriptPath).toBe('/driver-pwa-sw.js');
});
