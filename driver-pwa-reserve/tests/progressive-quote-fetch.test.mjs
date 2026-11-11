import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const api=fs.readFileSync(new URL('../src/liveApi.ts',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../src/ReserveApp.tsx',import.meta.url),'utf8');
test('slow quote history cannot hold up authenticated bookings and marketplace',()=>{
 assert.match(api,/includeBidHistory = true/);
 assert.match(api,/includeBidHistory \? driverGet\('\/mobile\/bids', token, 30000\) : Promise\.resolve\(\{\}\)/);
 assert.match(app,/loadLiveWithDiagnostics\(token, undefined, false\)/);
 assert.match(app,/void driverGet\('\/mobile\/bids', token, 30000\)/);
 assert.match(app,/setJobs\(previous=>applyPersonalBids\(previous,bidData\)\)/);
});
test('quote loading is displayed without implying there are no bids',()=>{
 assert.match(app,/const waitingQuotes=tab==='Quotes'&&bidsLoading/);
 assert.match(app,/Loading your quote history/);
 assert.match(app,/bidsPendingRef\.current=false/);
});
test('quote and offer enrichment preserves existing jobs',()=>{
 assert.match(api,/export function applyPersonalBids\(jobs:LiveJob\[\], bids:Json\)/);
 assert.match(api,/result\.set\(id, \{ \.\.\.existing, \.\.\.quoteFields \}\)/);
 assert.match(api,/return \[\.\.\.result\.values\(\)\]/);
});
