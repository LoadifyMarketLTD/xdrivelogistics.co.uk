import test from 'node:test';
import assert from 'node:assert/strict';
import { reserveJobs, reserveCounts } from '../src/reserveLists.ts';
const jobs=[
 {id:'one',status:'OPEN',marketplaceListed:true,quote:undefined,from:'Portsmouth',to:'Brighton',vehicle:'Luton'},
 {id:'two',status:'OPEN',marketplaceListed:true,quote:220,bidId:'bid2',bidStatus:'submitted',personalBid:true,from:'London',to:'Bristol',vehicle:'Luton'},
 {id:'three',status:'ALLOCATED',quote:180,quoteOutcome:'AWARDED',bidStatus:'accepted',personalBid:true,from:'Guildford',to:'Oxford',vehicle:'Small Van'},
 {id:'four',status:'OPEN',marketplaceListed:true,quote:undefined,from:'Chichester',to:'Worthing',vehicle:'Small Van'},
 {id:'five',status:'OPEN',quote:99,bidId:'bid5',bidStatus:'submitted',personalBid:true,from:'Historic Bid',to:'Unknown',vehicle:'Luton'},
 {id:'six',status:'OPEN',marketplaceListed:true,quote:240,bidId:'bid6',bidStatus:'withdrawn',personalBid:true,quoteOutcome:'CANCELLED',from:'Worthing',to:'London',vehicle:'Luton'},
 {id:'seven',status:'OPEN',quote:80,bidStatus:'rejected',personalBid:true,quoteOutcome:'UNSUCCESSFUL',from:'Oxford',to:'Reading',vehicle:'Luton'}
];
test('Loads shows all OPEN marketplace jobs including those already quoted',()=>{
 assert.deepEqual(reserveJobs(jobs,'Loads').map(x=>x.id),['one','two','four','six']);
 assert.deepEqual(reserveJobs(jobs,'Loads','london').map(x=>x.id),['two','six']);
 assert.deepEqual(reserveJobs(jobs,'Loads','','Small Van').map(x=>x.id),['four']);
});
test('Quotes owns submissions; separate History keeps withdrawn/unsuccessful records',()=>{
 assert.deepEqual(reserveJobs(jobs,'Quotes').map(x=>x.id),['two','five']);
 assert.deepEqual(reserveJobs(jobs,'Quotes','','All','Awarded').map(x=>x.id),['three']);
 assert.deepEqual(reserveJobs(jobs,'Quotes','','All','History').map(x=>x.id),['six','seven']);
 assert.deepEqual(reserveJobs(jobs,'Bookings').map(x=>x.id),['three']);
});
test('counts reflect available and active quoted loads only',()=>{
 assert.deepEqual(reserveCounts(jobs),{total:7,open:4,unquoted:3,quoted:1,historyOnly:2,booked:1,offers:0});
});
