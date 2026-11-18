import test from 'node:test';
import assert from 'node:assert/strict';
import { qaWriteAllowed } from '../src/qaNetworkGuard.ts';

const basic={origin:'http://127.0.0.1:5220',qaMode:true,allowAuthLogin:false,allowSyntheticLocalWrites:false};
const target='http://127.0.0.1:5220/xdrive-api/driver/mobile/jobs/22222222-3333-4444-8555-666666666666';
test('QA blocks all business writes even when same-origin or using an absolute public URL',()=>{
 for(const verb of ['POST','PUT','PATCH','DELETE']){
  assert.equal(qaWriteAllowed(verb, '/xdrive-api/driver/mobile/jobs/abc/status',basic),false);
  assert.equal(qaWriteAllowed(verb, 'https://www.xdrivelogistics.co.uk/api/driver/mobile/jobs/abc/status',basic),false);
  assert.equal(qaWriteAllowed(verb, '/xdrive-api/booking-offers/abc/respond',basic),false);
  assert.equal(qaWriteAllowed(verb, '/xdrive-api/driver/web/jobs/abc/pod-draft',basic),false);
  assert.equal(qaWriteAllowed(verb, '/api/driver/finance/jobs/abc/generate-invoice',basic),false);
 }
 assert.equal(qaWriteAllowed('GET','https://www.xdrivelogistics.co.uk/api/driver/profile',basic),true);
});
test('QA read-only authentication allows only password token endpoint',()=>{
 const p={...basic,allowAuthLogin:true};
 assert.equal(qaWriteAllowed('POST','https://jqxlauexhkonixtjvljw.supabase.co/auth/v1/token?grant_type=password',p),true);
 assert.equal(qaWriteAllowed('POST','https://jqxlauexhkonixtjvljw.supabase.co/auth/v1/token?grant_type=refresh_token',p),true);
 assert.equal(qaWriteAllowed('POST','https://jqxlauexhkonixtjvljw.supabase.co/auth/v1/logout',p),true);
 assert.equal(qaWriteAllowed('POST','https://jqxlauexhkonixtjvljw.supabase.co/rest/v1/jobs',p),false);
 assert.equal(qaWriteAllowed('POST','https://jqxlauexhkonixtjvljw.supabase.co/auth/v1/admin/users',p),false);
});
test('Synthetic QA permits exactly local fixture status/Undo; no other writes',()=>{
 const p={...basic,allowSyntheticLocalWrites:true};
 assert.equal(qaWriteAllowed('POST',target+'/status',p),true);
 assert.equal(qaWriteAllowed('POST',target+'/undo-status',p),true);
 assert.equal(qaWriteAllowed('PUT',target+'/status',p),false);
 assert.equal(qaWriteAllowed('POST',target+'/pod',p),false);
 assert.equal(qaWriteAllowed('POST',target.replace('22222222-3333-4444-8555-666666666666','aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')+'/status',p),false);
 assert.equal(qaWriteAllowed('POST','https://www.xdrivelogistics.co.uk/api/driver/mobile/jobs/22222222-3333-4444-8555-666666666666/status',p),false);
 assert.equal(qaWriteAllowed('POST',target+'/status',{...p,origin:'https://www.xdrivelogistics.co.uk'}),false);
});
test('Production build is unaffected by QA firewall decision',()=>{
 assert.equal(qaWriteAllowed('POST','/api/driver/mobile/jobs/abc/status',{...basic,qaMode:false}),true);
});
