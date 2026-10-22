import { expect, test } from '@playwright/test';

const jobId = '00000000-0000-4000-8000-000000000000';

test('PWA booking undo and stop actions require authenticated driver access', async ({ request }) => {
  for (const [action, data] of [
    ['undo-status', { expectedCurrentStatus: 'on_site_pickup' }],
    ['stop-status', { stop_id: jobId, status: 'arrived' }],
  ] as const) {
    const response = await request.post(`/api/driver/web/jobs/${jobId}/${action}`, { data });
    expect([401, 403, 503], `${action} returned HTTP ${response.status()}`)
      .toContain(response.status());
    expect(response.headers()['cache-control'] ?? '').not.toMatch(/public.*max-age/i);
  }
});
