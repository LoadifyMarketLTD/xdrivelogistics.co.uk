import { expect, test } from '@playwright/test';

const missingId = '00000000-0000-4000-8000-000000000000';

test('driver PWA API rejects unauthenticated reads without exposing private data', async ({ request }) => {
  for (const path of [
    '/api/driver/web/nearby-jobs',
    '/api/driver/web/bids',
    '/api/driver/web/jobs',
    '/api/driver/web/resources',
    `/api/driver/web/jobs/${missingId}`,
    `/api/driver/web/documents/${missingId}`,
  ]) {
    const response = await request.get(path);
    expect([401, 403, 503], `${path} unexpectedly responded HTTP ${response.status()}`).toContain(response.status());
    expect(response.headers()['cache-control'] ?? '').not.toMatch(/public.*max-age/i);
  }
});

test('driver PWA mutation routes are registered and deny bearer-less requests', async ({ request }) => {
  for (const path of [
    '/api/driver/web/bids',
    `/api/driver/web/bids/${missingId}`,
    '/api/driver/web/resources',
    `/api/driver/web/jobs/${missingId}/loaded`,
  ]) {
    const response = await request.post(path, { data: {} });
    expect([401, 403, 503], `${path} unexpectedly responded HTTP ${response.status()}`).toContain(response.status());
  }
});
