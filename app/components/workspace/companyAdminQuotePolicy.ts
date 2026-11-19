import { canonicalQuoteStage, type QuoteLifecycleRecord, type CanonicalQuoteStage } from '../../../lib/quotes/canonicalQuote';

type Bid = QuoteLifecycleRecord & { company_id: string | null; currency?: string | null; amount?: number | string | null; bid_price_gbp?: number | string | null; job?: { current_status?: string | null; status?: string | null } | null };
type Load = { company_id: string | null; myBid: Bid | null };

// Mirror the current company marketplace API, without granting new authority.
export function companyAdminQuoteStage(bid: Bid): CanonicalQuoteStage {
  const status = String(bid.status ?? '').trim().toLowerCase();
  if (bid.bidder_archived_at) return 'archived';
  if (status === 'expired') return 'expired';
  if (status === 'viewed' || status === 'shortlisted') {
    const expired = ['expired','cancelled'].includes(String(bid.job?.current_status ?? bid.job?.status ?? '').toLowerCase());
    return expired ? 'expired' : status;
  }
  return canonicalQuoteStage(bid, 'bidder', {jobExpired:['expired','cancelled'].includes(String(bid.job?.current_status ?? bid.job?.status ?? '').toLowerCase())});
}
export function canCompanyAdminQuote(load: Load, companyId: string | null): boolean {
  if (!companyId || !load.company_id || load.company_id === companyId) return false;
  return !load.myBid || (load.myBid.company_id === companyId && ['withdrawn','rejected','unsuccessful'].includes(String(load.myBid.status)));
}
export function canCompanyAdminCancelQuote(load: Load, companyId: string | null): boolean {
  const bid=load.myBid;
  return !!companyId && !!bid && bid.company_id === companyId && bid.status === 'submitted' && ['submitted','viewed','shortlisted'].includes(companyAdminQuoteStage(bid));
}
export function companyAdminBidAmount(bid: Bid): number | null {
  const finite=(v:number|string|null|undefined)=>v==null||String(v).trim()===''?null:Number.isFinite(Number(v))?Number(v):null;
  return (bid.currency && bid.currency!=='GBP') ? finite(bid.amount) : finite(bid.bid_price_gbp) ?? finite(bid.amount);
}
