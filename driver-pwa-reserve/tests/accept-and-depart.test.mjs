import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptAndStartCollection} from '../src/acceptAndStartCollection.ts';
const job='11111111-2222-4333-8444-555555555555';

test('Accept automatically records accepted and on_my_way, checking server final status',async()=>{
 const transitions=[];
 const result=await acceptAndStartCollection(job,{
  accept:async()=>({success:true,job_id:job,job_status:'allocated'}),
  setStatus:async next=>{transitions.push(next)},
  readStatus:async()=> 'on_my_way'
 });
 assert.deepEqual(transitions,['accepted','on_my_way']);
 assert.equal(result.accepted,true);assert.equal(result.departed,true);
});
test('No duplicate accepted transition if already accepted',async()=>{
 const transitions=[];
 const result=await acceptAndStartCollection(job,{
  accept:async()=>({success:true,job_id:job,job_status:'accepted'}),
  setStatus:async next=>{transitions.push(next)},
  readStatus:async()=> 'on_my_way'
 });
 assert.deepEqual(transitions,['on_my_way']);assert.equal(result.departed,true);
});
test('Contractual offer refusal does not create any transport status',async()=>{
 let n=0;
 await assert.rejects(acceptAndStartCollection(job,{accept:async()=>{throw Error('Offer refused')},setStatus:async()=>{n++},readStatus:async()=>''}),/Offer refused/);
 assert.equal(n,0);
});
test('No transport status when no assigned driver',async()=>{
 let n=0;
 const result=await acceptAndStartCollection(job,{accept:async()=>({success:true,job_id:job,job_status:'awarded'}),setStatus:async()=>{n++},readStatus:async()=>''});
 assert.equal(result.departed,false);assert.equal(result.accepted,true);assert.equal(n,0);
});
test('Partial success never pretends departure and does not repeat acceptance',async()=>{
 let accepted=0;const transitions=[];
 const result=await acceptAndStartCollection(job,{accept:async()=>{accepted++;return {success:true,job_id:job,job_status:'allocated'}},setStatus:async next=>{transitions.push(next);if(next==='on_my_way')throw Error('network')},readStatus:async()=>''});
 assert.equal(accepted,1);assert.equal(result.accepted,true);assert.equal(result.departed,false);assert.deepEqual(transitions,['accepted','on_my_way']);
 assert.match(result.reason||'',/Booking accepted/);
});
test('Read-back mismatch is not counted as successful departure',async()=>{
 const result=await acceptAndStartCollection(job,{accept:async()=>({success:true,job_id:job,job_status:'allocated'}),setStatus:async()=>{},readStatus:async()=> 'accepted'});
 assert.equal(result.departed,false);
});
test('Mismatched accepted booking ID prevents subsequent transitions',async()=>{
 let n=0;const result=await acceptAndStartCollection(job,{accept:async()=>({success:true,job_id:'wrong',job_status:'allocated'}),setStatus:async()=>{n++},readStatus:async()=>''});
 assert.equal(n,0);assert.equal(result.departed,false);assert.equal(result.accepted,false);
});
