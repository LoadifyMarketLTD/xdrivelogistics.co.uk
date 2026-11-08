import test from 'node:test';
import assert from 'node:assert/strict';
import { reserveJobs, reserveCounts } from '../src/reserveLists.ts';
const jobs=[
 {id:'one',status:'OPEN',marketplaceListed:true,quote:undefined,from:'Portsmouth',to:'Brighton',vehicle:'Luton'},
 {id:'two',status:'OPEN',marketplaceListed:true,quote:220,from:'London',to:'Bristol',vehicle:'Luton'},
 {id:'three',status:'ALLOCATED',quote:180,quoteOutcome:'AWARDED',from:'Guildford',to:'Oxford',vehicle:'Small Van'},
 {id:'four',status:'OPEN',marketplaceListed:true,quote:undefined,from:'Chichester',to:'Worthing',vehicle:'Small Van'},
 {id:'five',status:'OPEN',quote:99,from:'Historic Bid',to:'Unknown',vehicle:'Luton'}
];
test('marketplace quoted OPEN loads remain listed; orphan bids stay in Quotes only',()=>{
 assert.deepEqual(reserveJobs(jobs,'Loads').map(x=>x.id),['one','two','four']);
 assert.deepEqual(reserveJobs(jobs,'Quotes').map(x=>x.id),['two','three','five']);
 assert.deepEqual(reserveJobs(jobs,'Bookings').map(x=>x.id),['three']);
});
test('marketplace source tracking and filters remain accurate',()=>{
 assert.deepEqual(reserveJobs(jobs,'Loads','london').map(x=>x.id),['two']);
 assert.deepEqual(reserveJobs(jobs,'Loads','','Small Van').map(x=>x.id),['four']);
 assert.deepEqual(reserveCounts(jobs),{total:5,open:3,unquoted:2,quoted:1,historyOnly:1,booked:1,offers:0});
});
