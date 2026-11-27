import {describe,it,expect} from 'vitest';
import {ownerQuoteMatches,OWNER_QUOTE_SCOPES} from '../app/driver/_components/ownerQuoteRegister';
describe('Owner Driver quote register',()=>{
 it.each([['incoming','submitted','received'],['outgoing','submitted','submitted'],['outgoing','expired','unsuccessful'],['outgoing','rejected','unsuccessful'],['incoming','withdrawn','archived'],['outgoing','accepted','awarded']] as const)('classifies %s %s exactly once',(direction,status,expected)=>{const bid={direction,status};expect(OWNER_QUOTE_SCOPES.filter(x=>x.id!=='total'&&ownerQuoteMatches(bid,x.id)).map(x=>x.id)).toEqual([expected]);});
 it('honours each party archive state independently',()=>{const bid={direction:'incoming' as const,status:'accepted',bidder_archived_at:'2026-11-19'};expect(ownerQuoteMatches(bid,'awarded')).toBe(true);expect(ownerQuoteMatches({...bid,poster_archived_at:'2026-11-19'},'archived')).toBe(true);});
 it('keeps drafts out of active trading registers',()=>expect(ownerQuoteMatches({direction:'outgoing',status:'draft'},'submitted')).toBe(false));
});
