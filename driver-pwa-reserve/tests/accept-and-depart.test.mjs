import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../src/ReserveApp.tsx',import.meta.url),'utf8');
const lifecycle=fs.readFileSync(new URL('../src/reserveLifecycle.ts',import.meta.url),'utf8');

test('Accept records accepted only; departure remains a separate explicit driver action',()=>{
  assert.doesNotMatch(app,/acceptAndStartCollection/);
  const start=app.indexOf('async function acceptIncomingJob');
  const end=app.indexOf('function incoming()',start);
  assert.ok(start>=0&&end>start);
  const block=app.slice(start,end);
  assert.match(block,/bookingOfferRespond\(s\.token,j\.offerId!,'accept'\)/);
  assert.match(block,/nextStatus:'accepted'/);
  assert.doesNotMatch(block,/nextStatus:'on_my_way'/);
  assert.match(block,/status:'ALLOCATED',backendStatus:'accepted'/);
});

test('On My Way to Pickup is the next manual lifecycle action after Accepted',()=>{
  assert.match(lifecycle,/ALLOCATED:\{label:'On My Way to Pickup',backend:'on_my_way',status:'ON_WAY_TO_PICKUP'\}/);
  const flow=app.slice(app.indexOf('function flow()'));
  assert.match(flow,/job\.status==='ALLOCATED'/);
  assert.match(flow,/On My Way to Pickup/);
});

test('Declining an offer remains separate from transport lifecycle writes',()=>{
  const incoming=app.slice(app.indexOf('function incoming()'),app.indexOf('const undoTargets'));
  assert.match(incoming,/bookingOfferRespond\(s\.token,job\.offerId!,'decline'\)/);
  assert.doesNotMatch(incoming,/nextStatus:'on_my_way'/);
});
