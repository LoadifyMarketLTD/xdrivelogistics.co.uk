export function offeredQuoteLabel(bid:{status:string|null;amount:number|null;created_at?:string|null;updated_at?:string|null}):string {
  const amount=bid.amount!=null&&Number.isFinite(bid.amount)?new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(bid.amount):'Amount not supplied';
  const raw=bid.updated_at||bid.created_at;
  const date=raw?new Date(raw):null;
  const time=date&&!Number.isNaN(date.getTime())?new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date):null;
  const prefix=bid.status==='submitted'?'You Quoted':bid.status==='accepted'?'Quote Accepted':bid.status==='rejected'?'Quote Rejected':'Quote';
  return prefix+' '+amount+(time?' @ '+time:'');
}
