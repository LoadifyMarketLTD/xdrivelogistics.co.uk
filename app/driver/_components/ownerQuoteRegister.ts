import {canonicalQuoteStage,type QuoteLifecycleRecord} from '../../../lib/quotes/canonicalQuote';
export const OWNER_QUOTE_SCOPES=[{id:'received',label:'Received'},{id:'archived',label:'Archived'},{id:'submitted',label:'Submitted'},{id:'unsuccessful',label:'Unsuccessful'},{id:'awarded',label:'Awarded'},{id:'total',label:'All Quotes'}] as const;
export type OwnerQuoteScope=typeof OWNER_QUOTE_SCOPES[number]['id'];
type Quote=QuoteLifecycleRecord&{direction:'incoming'|'outgoing'};
export function ownerQuoteStage(bid:Quote){
 const stage=canonicalQuoteStage(bid,bid.direction==='incoming'?'poster':'bidder');
 if(stage!=='archived'&&String(bid.status??'').trim().toLowerCase()==='expired')return 'expired' as const;
 return stage;
}
export function ownerQuoteMatches(bid:Quote,scope:OwnerQuoteScope):boolean{
 const stage=ownerQuoteStage(bid);
 if(scope==='total')return true;
 if(scope==='archived')return ['archived','withdrawn'].includes(stage);
 if(scope==='awarded')return stage==='accepted';
 if(scope==='unsuccessful')return ['unsuccessful','expired'].includes(stage);
 if(scope==='received')return bid.direction==='incoming'&&['submitted','viewed','shortlisted'].includes(stage);
 return bid.direction==='outgoing'&&['submitted','viewed','shortlisted'].includes(stage);
}
