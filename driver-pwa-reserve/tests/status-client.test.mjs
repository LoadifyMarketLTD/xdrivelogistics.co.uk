import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDriverApi, DriverApiError } from '../src/realApi.ts';
const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });
test('driver status client rejects fixture identifiers and unknown actions', () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Unexpected network'); };
  const api = makeDriverApi(async () => 'token');
  assert.throws(() => api.updateJobStatus('TEST-1099', 'loaded'), e => e instanceof DriverApiError && e.status === 400);
  assert.throws(() => api.updateJobStatus('real-id', 'delete'), e => e instanceof DriverApiError && e.status === 400);
  assert.equal(calls, 0);
});
test('driver status client uses authenticated web lifecycle endpoint', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/driver/web/jobs/real-id/arrived-pickup');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer token');
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  await makeDriverApi(async () => 'token').updateJobStatus('real-id', 'arrived-pickup');
});

test('status notes are forwarded to the server and oversized notes are rejected', async () => { const api = makeDriverApi(async () => 'token'); assert.throws(() => api.updateJobStatus('real-id', 'loaded', 'x'.repeat(5001)), e => e instanceof DriverApiError && e.status === 400); globalThis.fetch = async (url, options) => { assert.equal(url, '/api/driver/web/jobs/real-id/loaded'); assert.deepEqual(JSON.parse(options.body), { driverNotes: 'Collected two pallets' }); return { ok: true, status: 200, json: async () => ({ ok: true }) }; }; await api.updateJobStatus('real-id', 'loaded', 'Collected two pallets'); });
