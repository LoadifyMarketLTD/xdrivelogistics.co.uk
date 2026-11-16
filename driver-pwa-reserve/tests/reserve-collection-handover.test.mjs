import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/ReserveApp.tsx',import.meta.url),'utf8');
const endpoint=readFileSync(new URL('../../app/api/driver/mobile/jobs/[id]/handover/route.ts',import.meta.url),'utf8');

test('Loaded handover uses canonical ISO etaAt and packaging, with optional date-time input',()=>{
 assert.match(app,/label="Packaging"/);
 assert.match(app,/label="ETA to delivery \(date and time\) \(optional\)"/);
 assert.match(app,/type="datetime-local" value=\{deliveryEtaAt\}/);
 assert.match(app,/const etaAt=etaDate\?etaDate\.toISOString\(\):null/);
 assert.match(app,/packaging:packaging\.trim\(\),weightKg,etaAt/);
 assert.match(endpoint,/const etaProvided = typeof body\.etaAt === 'string'/);
 assert.match(endpoint,/const etaAt = etaDate && Number\.isFinite\(etaDate\.getTime\(\)/);
 assert.match(endpoint,/const packaging = cleanString\(body\.packaging, 120\)/);
});
test('Arrival and loaded handover validate counts and weight before server transitions',()=>{
 assert.match(app,/Number\.isInteger\(arrivalItems\)/);
 assert.match(app,/Number\.isFinite\(arrivalWeight\)/);
 assert.match(app,/Number\.isInteger\(itemCount\)/);
 assert.match(app,/Number\.isFinite\(weightKg\)/);
 assert.match(app,/if\(etaDate&&!Number\.isFinite\(etaDate\.getTime\(\)\)/);
 assert.match(app,/stage:'arrival',itemCount:arrivalItems/);
 assert.match(app,/stage:'loaded',itemCount,packaging:packaging\.trim\(\)/);
 assert.match(app,/await driverPost\('\/mobile\/jobs\/'\+encodeURIComponent\(j\.id\)\+'\/status'/);
});
test('ETA is optional, date-time based and not hard-coded',()=>{
 assert.match(app,/deliveryEtaAt\.trim\(\)===''\?null:new Date\(deliveryEtaAt\)/);
 assert.match(app,/const etaAt=etaDate\?etaDate\.toISOString\(\):null/);
 assert.doesNotMatch(app,/setEta\('22:30'\)/);
 assert.match(endpoint,/if \(etaProvided && !etaAt\)/);
});
test('Collection camera and file picker upload authenticated collection evidence',()=>{
 assert.match(app,/getUserMedia\(\{video:\{facingMode:\{ideal:'environment'\}\},audio:false\}\)/);
 assert.match(app,/captureCollectionPhoto/);
 assert.match(app,/accept="image\/jpeg,image\/png,application\/pdf" multiple/);
 assert.match(app,/x-xdrive-evidence-kind':'collection'/);
 assert.match(app,/x-xdrive-evidence-category':category/);
 assert.match(app,/const evidence=await uploadCollectionEvidence\(j,s\.token\)/);
 assert.match(app,/photoPaths:evidence\.photos,documentPaths:evidence\.documents/);
 const route=readFileSync(new URL('../../app/api/driver/mobile/jobs/[id]/evidence/route.ts',import.meta.url),'utf8');
 assert.match(route,/kind === 'collection'/);
});
