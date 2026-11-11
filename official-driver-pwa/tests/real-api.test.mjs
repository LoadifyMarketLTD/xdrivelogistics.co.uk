import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDriverApi, DriverApiError } from '../src/realApi.ts';
const originalFetch = globalThis.fetch;
const reply = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
test.afterEach(() => { globalThis.fetch = originalFetch; });
test('unauthenticated sessions never request driver data', async () => {
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error('unexpected network'); };
  await assert.rejects(makeDriverApi(async () => null).loadSnapshot(), e => e instanceof DriverApiError && e.status === 401);
  assert.equal(requests, 0);
});
test('server failure is surfaced, never replaced by fake jobs', async () => {
  globalThis.fetch = async () => reply({ error: 'Access denied' }, 403);
  await assert.rejects(makeDriverApi(async () => 'token').loadSnapshot(), e => e instanceof DriverApiError && e.status === 403);
});
test('real snapshot deduplicates assigned bookings', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer token');
    if (url.includes('search-loads')) return reply({ rows: [{ id: 'real-a' }] });
    if (url.includes('/bids')) return reply({ bids: [] });
    if (url.includes('scope=active')) return reply({ jobs: [{ id: 'real-b' }] });
    if (url.includes('scope=completed')) return reply({ jobs: [{ id: 'real-b' }, { id: 'real-c' }] });
    throw new Error('Unexpected endpoint');
  };
  const snapshot = await makeDriverApi(async () => 'token').loadSnapshot();
  assert.deepEqual(snapshot.bookings.map(j => j.id), ['real-b', 'real-c']);
});
test('invalid API payload is rejected instead of displayed', async () => {
  globalThis.fetch = async () => reply({});
  await assert.rejects(makeDriverApi(async () => 'token').loadSnapshot(), e => e instanceof DriverApiError && e.status === 502);
});
test('marketplace 403 for non-commercial company driver preserves assigned jobs', async () => {
  globalThis.fetch = async (url) => {
    if (url.includes('search-loads')) return reply({ error: 'Commercial marketplace access is not enabled' }, 403);
    if (url.includes('/bids')) return reply({ bids: [] });
    if (url.includes('scope=active')) return reply({ jobs: [{ id: 'real-assigned' }] });
    if (url.includes('scope=completed')) return reply({ jobs: [] });
    throw new Error('Unexpected endpoint');
  };
  const snapshot = await makeDriverApi(async () => 'token').loadSnapshot();
  assert.deepEqual(snapshot.marketplace, []);
  assert.deepEqual(snapshot.bookings.map(job => job.id), ['real-assigned']);
});
