import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
test('production More screen excludes sandbox controls and fake availability', () => {
  for (const label of ['Local test workspace','Load clearly labeled test fixtures','Clear local test data','Realtime feed not connected.','Available for new loads (local only)','Awaiting authenticated backend connection']) {
    assert.equal(source.includes(label), false, `Legacy control still visible: ${label}`);
  }
});
test('role is resolved through authenticated driver profile', () => {
  assert.match(source, /driverGet\("\/profile", token\)/);
  assert.doesNotMatch(source, /setRole\(e\.target\.value/);
});
test('unauthenticated app starts on sign-in instead of test jobs', () => {
  assert.match(source, /if \(!savedLiveSession\(\)\) return "More"/);
assert.match(source, /xdrive-driver-active-tab-v1/);
assert.match(source, /: "Bookings"/);
  assert.match(source, /Sign in to XDrive Logistics/);
});