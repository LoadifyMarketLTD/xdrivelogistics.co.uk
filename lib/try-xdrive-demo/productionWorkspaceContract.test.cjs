const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const boundary = read('lib/try-xdrive-demo/productionProject.ts');
assert.match(boundary, /jqxlauexhkonixtjvljw/);
assert.doesNotMatch(boundary, /svfjlhljuizckzabtewx/);
assert.match(boundary, /url\.protocol === 'https:'/);
assert.match(boundary, /url\.hostname ===/);

const auth = read('app/api/try-xdrive-demo/memberAuth.ts');
const fetcher = read('lib/try-xdrive-demo/authenticatedFetch.ts');
assert.match(auth, /isAuthorizedXDriveProductionUrl/);
assert.match(fetcher, /isAuthorizedXDriveProductionUrl/);
assert.doesNotMatch(auth + fetcher, /dedicated Supabase staging project|Dedicated staging configuration unavailable/);

const loads = read('app/api/try-xdrive-demo/loads/route.ts');
const bids = read('app/api/try-xdrive-demo/quotes/route.ts');
const awards = read('app/api/try-xdrive-demo/quotes/award/route.ts');
const respond = read('app/api/try-xdrive-demo/bookings/respond/route.ts');
const allocate = read('app/api/try-xdrive-demo/bookings/allocate/route.ts');
for (const source of [loads, bids, awards, respond, allocate]) {
 assert.doesNotMatch(source, /xdrive_demo_awards/);
}
assert.match(loads, /CANONICAL_POST_LOAD_REQUIRED/);
assert.match(bids, /companyMarketplaceAction/);
assert.match(awards, /PAYMENT_OBLIGATION_ACK_REQUIRED/);
assert.match(respond, /respondCanonicalOffer/);
assert.match(allocate, /CANONICAL_ALLOCATION_REQUIRED/);
console.log('PASS production workspace environment, quote and booking safety boundaries');
