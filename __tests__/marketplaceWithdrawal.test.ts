import { describe, it, expect } from 'vitest';
import { canWithdrawMarketplaceBid as allowed } from '../app/api/driver/_lib/marketplaceWithdrawal';
const bid = {id:'bid-a',status:'submitted',bidder_user_id:'user-a',bidder_driver_id:'driver-a'};
const viewer = {userId:'user-a',driverId:'driver-a'};
const empty = new Set<string>();
describe('Marketplace withdrawal eligibility', () => {
  it('allows own submitted quote', () => expect(allowed(bid, {}, viewer, empty)).toBe(true));
  it('blocks pending offer or unavailable offer verification', () => expect(allowed(bid, {}, viewer, new Set(['bid-a']))).toBe(false));
  it('ignores unrelated pending offer', () => expect(allowed(bid, {}, viewer, new Set(['bid-b']))).toBe(true));
  it('blocks another user', () => expect(allowed(bid, {}, {...viewer,userId:'user-b'}, empty)).toBe(false));
  it('blocks another driver', () => expect(allowed(bid, {}, {...viewer,driverId:'driver-b'}, empty)).toBe(false));
  it.each(['accepted','rejected','withdrawn',null])('blocks non-submitted status %s', status => expect(allowed({...bid,status}, {}, viewer, empty)).toBe(false));
  it.each(['awarded_carrier_company_id','assigned_company_id','assigned_driver_id'])('blocks allocation %s', key => expect(allowed(bid, {[key]:'assigned'}, viewer, empty)).toBe(false));
});
