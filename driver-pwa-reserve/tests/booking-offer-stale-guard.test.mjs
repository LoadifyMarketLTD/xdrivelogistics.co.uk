import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root = new URL('../../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');

test('booking API exposes quotation status and blocks stale pending offers', () => {
  const api = read('app/api/booking-offers/route.ts');
  assert.match(api, /from\('job_bids'\)\.select\('id,status'\)/);
  assert.match(api, /if \(jobsError \|\| buyersError \|\| bidsError\)/);
  assert.match(api, /if \(bidIds\.some\(\(id\) => !bidById\.has\(id\)\)\)/);
  assert.match(api, /quote_status: bidById\.get/);
  assert.match(api, /acceptance_blocked: offer\.status === 'pending' && String\(bidById\.get/);
});
test('driver UI shows stale offer reason and disables acceptance, not decline', () => {
  const api = read('driver-pwa-reserve/src/liveApi.ts');
  const ui = read('driver-pwa-reserve/src/ReserveApp.tsx');
  assert.ok(api.includes("acceptanceBlocked: pending && (offer.acceptance_blocked === true"));
  assert.match(ui, /job\.acceptanceBlocked\?'This awarded booking cannot be accepted/);
  assert.match(ui, /disabled=\{busy\|\|job\.acceptanceBlocked\}/);
  assert.match(ui, /bookingOfferRespond\(s\.token,job\.offerId!,'decline'\)/);
});
test('both company and driver quote withdrawal check pending booking offers', () => {
  const company = read('app/api/marketplace/company/route.ts');
  const driver = read('app/api/driver/bids/[id]/withdraw/route.ts');
  assert.match(company, /\.from\('job_booking_offers'\)/);
  assert.match(company, /code: 'PENDING_BOOKING_OFFER'/);
  assert.match(driver, /\.from\('job_booking_offers'\)/);
  assert.match(driver, /code:'PENDING_BOOKING_OFFER'/);
});
test('proposed transactional database guard is fail closed and not auto-repair', () => {
  const sql = read('docs/proposals/BOOKING_OFFER_PENDING_BID_GUARD_QA_ONLY.sql');
  assert.match(sql, /BEFORE UPDATE OF status ON public\.job_bids/);
  assert.match(sql, /OLD\.status::text = 'submitted'/);
  assert.match(sql, /offer\.bid_id = OLD\.id AND offer\.status = 'pending'/);
  assert.doesNotMatch(sql, /UPDATE public\.job_booking_offers SET/);
});
test('quote history prioritizes withdrawn status over stale incoming-offer label', () => {
  const ui = read('driver-pwa-reserve/src/ReserveApp.tsx');
  assert.match(ui, /const status=tab==='Quotes'&&isWithdrawn\?'WITHDRAWN':offered\?/);
  assert.match(ui, /j\.acceptanceBlocked\?'OFFER BLOCKED'/);
});
test('client rejects withdrawn quote even when live API does not project acceptance_blocked', () => {
  const api = read('driver-pwa-reserve/src/liveApi.ts');
  assert.match(api, /existing\.acceptanceRequired && existing\.offerId && state !== 'submitted'/);
  assert.match(api, /offer\.acceptance_blocked === true \|\| str\(offer\.quote_status\)/);
  assert.match(api, /existing\?\.personalBid === true && Boolean\(existing\.bidStatus\) && existing\.bidStatus !== 'submitted'/);
});
