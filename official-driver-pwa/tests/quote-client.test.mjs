import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDriverApi, DriverApiError } from '../src/realApi.ts';
const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });
test('quote client rejects fixture IDs and invalid ETA without network', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Network not expected'); };
  const api = makeDriverApi(async () => 'valid-token');
  for (const [job, amount, eta] of [['TEST-1099', 100, 15], ['real-id', 100, 4], ['real-id', 100, 241], ['real-id', -1, 15], ['real-id', 100, 15.5]]) {
    assert.throws(() => api.submitQuote(job, amount, eta, ''), e => e instanceof DriverApiError && e.status === 400);
  }
  assert.equal(calls, 0);
});
test('quote client submits collection ETA and authenticated quote to real API', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/driver/bids');
    assert.equal(options.headers.Authorization, 'Bearer valid-token');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { jobId: 'real-id', amount: 120, collectWithinMinutes: 30, message: 'Can collect' });
    return { ok: true, status: 201, json: async () => ({ success: true, bidId: 'real-bid' }) };
  };
  const result = await makeDriverApi(async () => 'valid-token').submitQuote('real-id', 120, 30, 'Can collect');
  assert.equal(result.bidId, 'real-bid');
});
