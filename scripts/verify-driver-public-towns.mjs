import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const route = readFileSync(new URL('../app/api/driver/marketplace/loads/route.ts', import.meta.url), 'utf8');
const card = readFileSync(new URL('../app/driver-pwa-fresh/FreshJobCard.tsx', import.meta.url), 'utf8');
for (const [side, city] of [['pickup', 'pickup_city'], ['delivery', 'delivery_city']]) {
  assert.match(route, new RegExp(`${side}_area:\\s*marketplaceText\\(job\\.${city}\\)\\s*\\?\\?\\s*publicAreaLabel\\(job\\.${side}_postcode`), `${side}: public city must be preferred to postcode fallback`);
  assert.match(route, new RegExp(`${side}_postcode_area:\\s*publicOutcode\\(job\\.${side}_postcode\\)`), `${side}: outcode must be retained`);
  assert.match(route, new RegExp(`${side}_postcode_full:\\s*null`), `${side}: full postcode must remain private`);
  assert.match(card, new RegExp(`place\\(load\\.${side}_area,\\s*load\\.${side}_postcode_area\\)`), `${side}: card must display town and outcode`);
}
console.log('PASS: marketplace public town + outcode contract and pre-award privacy');