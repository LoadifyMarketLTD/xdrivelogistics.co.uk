export type ReceivedBidPrice={currency:string|null;amount:number|string|null;bid_price_gbp:number|string|null};
const positive=(value:unknown)=>value==null||String(value).trim()===''?null:Number.isFinite(Number(value))&&Number(value)>0?Number(value):null;
export function receivedBidPrice(bid:ReceivedBidPrice){
 const currency=String(bid.currency??'').trim().toUpperCase();
 if(!/^[A-Z]{3}$/.test(currency))return null;
 const amount=currency==='GBP'?positive(bid.bid_price_gbp)??positive(bid.amount):positive(bid.amount);
 return amount===null?null:{currency,amount,label:currency+' '+amount.toFixed(2)};
}
export const awardCurrencyVerified=(bid:ReceivedBidPrice)=>receivedBidPrice(bid)?.currency==='GBP';
export type BuyerOffer={id:string;job_id:string;bid_id:string;buyer_company_id:string;status:string};
export function pendingBuyerOffers(offers:BuyerOffer[],companyId:string|null){
 return new Map(offers.filter(o=>companyId&&o.buyer_company_id===companyId&&o.status==='pending').map(o=>[o.job_id,o]));
}
export function canAwardReceivedBid(bid:{bid_status:string;job_status:string;exchange_visibility:string;bidder_company_id:string|null;owner_company_id:string|null;awarded_carrier_company_id:string|null}&ReceivedBidPrice,companyId:string|null,pending:boolean,known:boolean){
 return Boolean(known&&!pending&&companyId&&bid.owner_company_id===companyId&&bid.bidder_company_id&&bid.bidder_company_id!==companyId&&!bid.awarded_carrier_company_id&&['posted','quoted'].includes(bid.job_status)&&['exchange','direct','private_group'].includes(bid.exchange_visibility)&&bid.bid_status==='submitted'&&awardCurrencyVerified(bid));
}
