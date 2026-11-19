import {describe,it,expect} from 'vitest';
import {offeredQuoteLabel} from '../app/driver/_components/ownerLoadQuoteState';
describe('Owner Driver load board quote footer',()=>{
 it('renders true GBP amount and London time',()=>expect(offeredQuoteLabel({status:'submitted',amount:70,created_at:'2026-11-19T09:06:00Z'})).toBe('You Quoted £70.00 @ 09:06'));
 it('uses updated timestamp for resubmitted quote and UK summer time',()=>expect(offeredQuoteLabel({status:'submitted',amount:125.5,created_at:'2026-06-01T09:06:00Z',updated_at:'2026-06-01T10:30:00Z'})).toBe('You Quoted £125.50 @ 11:30'));
 it('does not invent missing timestamp or amount',()=>expect(offeredQuoteLabel({status:'submitted',amount:null})).toBe('You Quoted Amount not supplied'));
 it('does not present accepted quotes as submitted',()=>expect(offeredQuoteLabel({status:'accepted',amount:70})).toBe('Quote Accepted £70.00'));
 it('ignores invalid timestamps',()=>expect(offeredQuoteLabel({status:'submitted',amount:5,created_at:'invalid'})).toBe('You Quoted £5.00'));
});
