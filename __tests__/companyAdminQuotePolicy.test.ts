import {describe,it,expect} from 'vitest';
import {canCompanyAdminQuote,canCompanyAdminCancelQuote,companyAdminQuoteStage,companyAdminBidAmount} from '../app/components/workspace/companyAdminQuotePolicy';
const bid={company_id:'ours',status:'submitted',currency:'GBP',amount:100,bid_price_gbp:100};
const load={company_id:'poster',myBid:bid};
describe('Company Admin quote authority',()=>{
 it('requires an identified active company, foreign poster, and no active bid',()=>{expect(canCompanyAdminQuote({...load,myBid:null},'ours')).toBe(true);expect(canCompanyAdminQuote({...load,myBid:null},null)).toBe(false);expect(canCompanyAdminQuote({...load,company_id:null,myBid:null},'ours')).toBe(false);expect(canCompanyAdminQuote({...load,company_id:'ours',myBid:null},'ours')).toBe(false);expect(canCompanyAdminQuote(load,'ours')).toBe(false)});
 it('only allows re-quoting own terminal bids supported by existing API',()=>{expect(canCompanyAdminQuote({...load,myBid:{...bid,status:'withdrawn'}},'ours')).toBe(true);expect(canCompanyAdminQuote({...load,myBid:{...bid,company_id:'other',status:'withdrawn'}},'ours')).toBe(false)});
 it('matches server withdrawal eligibility including submitted but viewed or shortlisted',()=>{expect(canCompanyAdminCancelQuote(load,'ours')).toBe(true);expect(canCompanyAdminCancelQuote({...load,myBid:{...bid,viewed_at:'2026-11-19'}},'ours')).toBe(true);expect(canCompanyAdminCancelQuote({...load,myBid:{...bid,status:'viewed'}},'ours')).toBe(false);expect(canCompanyAdminCancelQuote({...load,myBid:{...bid,bidder_archived_at:'2026-11-19'}},'ours')).toBe(false);expect(canCompanyAdminCancelQuote(load,'other')).toBe(false)});
 it('never treats a stored expired bid as submitted',()=>expect(companyAdminQuoteStage({...bid,status:'expired'})).toBe('expired'));
 it('does not interpret missing GBP value as zero for EUR quotes',()=>{expect(companyAdminBidAmount({...bid,currency:'EUR',bid_price_gbp:null,amount:150})).toBe(150);expect(companyAdminBidAmount({...bid,currency:'GBP',bid_price_gbp:null,amount:90})).toBe(90);expect(companyAdminBidAmount({...bid,bid_price_gbp:null,amount:null})).toBeNull()});
});
