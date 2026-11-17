import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/ReserveApp.tsx',import.meta.url),'utf8');
test('Delivered and POD both require server-verified current signature',()=>{
 const delivery=app.slice(app.indexOf('async function completeDelivery('),app.indexOf('async function savePod('));
 const pod=app.slice(app.indexOf('async function savePod('),app.indexOf('function flow()'));
 assert.match(delivery,/if\(!signature\|\|verifiedSignature!==signature\)/);
 assert.match(pod,/if\(!signature\|\|verifiedSignature!==signature\)/);
 assert.match(pod,/if\(await officialPodComplete\(\)\)return/);
 assert.match(pod,/if\(!\(await officialPodComplete\(\)\)\)throw new Error\('POD is not confirmed complete on the server/);
 assert.match(app,/setVerifiedSignature\(null\);setError\(''\)/);
});
