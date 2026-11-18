import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { qaWriteAllowed } from '../src/qaNetworkGuard.ts';

const entry=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const base={origin:'https://www.xdrivelogistics.co.uk',qaMode:true,allowAuthLogin:true,allowSyntheticLocalWrites:false};

test('Approved live release requires explicit build flag AND exact canonical production origin and pathname',()=>{
  assert.match(entry,/VITE_XDRIVE_DRIVER_APPROVED_LIVE_WRITES === '1'/);
  assert.match(entry,/import\.meta\.env\.PROD/);
  assert.match(entry,/location\.origin === 'https:\/\/www\.xdrivelogistics\.co\.uk'/);
  assert.match(entry,/location\.pathname === '\/driver\/reserve-pwa\/'/);
  assert.match(entry,/location\.pathname === '\/driver\/reserve-pwa\/index\.html'/);
  assert.match(entry,/VITE_CX4A_QA_MOCK !== '1'/);
  assert.match(entry,/location\.pathname\.startsWith\('\/driver\/reserve-rebuild-qa\/'\)/);
});
test('Canonical live release permits authorised API writes, QA preview still blocks all business writes',()=>{
  for(const method of ['POST','PUT','PATCH','DELETE']){
    const url='/api/driver/mobile/jobs/123/pod';
    assert.equal(qaWriteAllowed(method,url,{...base,qaMode:false}),true);
    assert.equal(qaWriteAllowed(method,url,{...base,qaMode:true}),false);
    assert.equal(qaWriteAllowed(method,'/api/driver/finance/jobs/123/generate-invoice',base),false);
  }
});
test('Firewall still installs before mount and never disables server authorization checks',()=>{
  assert.ok(entry.indexOf('installQaNetworkGuard(')<entry.indexOf('createRoot('));
  assert.match(entry,/const qaMode = !explicitLiveRelease/);
  assert.match(entry,/VITE_QA_SYNTHETIC_LOCAL_WRITES/);
});
