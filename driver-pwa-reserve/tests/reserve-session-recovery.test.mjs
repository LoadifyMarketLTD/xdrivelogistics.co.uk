import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/ReserveApp.tsx',import.meta.url),'utf8');
const api=readFileSync(new URL('../src/liveApi.ts',import.meta.url),'utf8');
test('Reserve verifies server-side cached session and force-renews rejected tokens',()=>{
 assert.match(app,/let s=await renewSession\(session\);try\{await driverGet\('\/profile',s\.token,7000\)/);
 assert.match(app,/s=await renewSession\(s,true\)/);
 assert.match(api,/renewSession\(session: LiveSession, forceRefresh = false\)/);
});
test('Reserve cannot display unauthorized feeds as empty marketplace data',()=>{
 assert.match(app,/result\.warnings\.filter\(message=>\/invalid session\|unauthorized\|jwt expired\|401\/i\.test\(message\)\)\.length>=2/);
 assert.match(app,/clearInvalidSession\(\)/);
});