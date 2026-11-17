import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=f=>fs.readFileSync(new URL('../src/'+f,import.meta.url),'utf8');
const api=f=>fs.readFileSync(new URL('../../app/api/driver/mobile/jobs/[id]/'+f,import.meta.url),'utf8');
const app=src('ReserveApp.tsx');
const handover=api('handover/route.ts');
const pod=api('[action]/route.ts');
const confirmation=api('confirmation/route.ts');
test('QA build installs central network firewall before mounting React',()=>{
 const main=src('main.tsx');
 assert.ok(main.indexOf('installQaNetworkGuard(')<main.indexOf('createRoot('));
 assert.match(main,/import\.meta\.env\.DEV/);
 assert.match(main,/VITE_CX4A_QA_MOCK/);
 assert.match(main,/VITE_QA_SYNTHETIC_LOCAL_WRITES/);
});
test('Hard-copy POD cannot submit before affirmative acknowledgment and sends actual checkbox value',()=>{
 assert.match(app,/const \[hardCopyAcknowledged,setHardCopyAcknowledged\]=useState\(false\)/);
 assert.match(app,/if\(j\.hardCopyPodRequired&&!hardCopyAcknowledged\)/);
 assert.match(app,/hardCopyAcknowledged:j\.hardCopyPodRequired\?hardCopyAcknowledged:false/);
 assert.match(app,/job\.hardCopyPodRequired&&<label className="rv-hard-copy-ack"/);
 assert.match(app,/disabled=\{busy\|\|!signature\|\|verifiedSignature!==signature\|\|\(job\.hardCopyPodRequired&&!hardCopyAcknowledged\)\}/);
 assert.match(pod,/hardCopyRequired && !hardCopyAcknowledged/);
 assert.match(app,/setHardCopyAcknowledged\(false\)/);
});
test('ETA is future-only on both client and server',()=>{
 assert.match(app,/etaDate\.getTime\(\)<=Date\.now\(\)/);
 assert.match(handover,/etaDate\.getTime\(\) <= Date\.now\(\)/);
 assert.match(app,/if\(deliveryEtaAt\.trim\(\)\)/);
 assert.ok(app.indexOf('if(deliveryEtaAt.trim())')<app.indexOf('const evidence=await uploadCollectionEvidence(j,s.token)'));
});
test('Loaded requires photo but arrival does not; confirmed delivery requires photo; POD does not demand a second one',()=>{
 assert.match(handover,/stage === 'loaded' && photoPaths\.length === 0/);
 assert.match(app,/collectionStage==='loaded'&&!evidence\.photos\.length/);
 assert.match(confirmation,/if \(!evidencePath\) return respond\(409/);
 assert.match(app,/if\(!evidence\.photos\.length\)throw new Error\('XDrive requires at least one verified delivery photo/);
 assert.match(pod,/Delivery photographs are optional unless a specific customer requirement applies/);
});
test('Optional arrival quantities and server-autofilled immutable collection references agree with handover API',()=>{
 assert.match(app,/pickupItems\.trim\(\)===''\?null:Number\(pickupItems\)/);
 assert.match(app,/pickupWeight\.trim\(\)===''\?null:Number\(pickupWeight\)/);
 assert.match(app,/label="Items Collected \(optional\)"/);
 assert.match(app,/label="Weight \(kg\) \(optional\)"/);
 assert.match(app,/label="XDrive Job Reference"/);
 assert.match(app,/carrierOperatorKind==='driver'\?'XDrive Owner Driver ID':'XDrive Carrier Company ID'/);
 assert.match(app,/readOnly aria-readonly="true" value=\{yourReference\}/);
 assert.match(app,/readOnly aria-readonly="true" value=\{carrierReference\}/);
 assert.match(handover,/getCollectionIdentity\(jobId, driver\.companyId, driver\.userId, driver\.driverType\)/);
 assert.match(handover,/transportOperatorReference: references!\.identity!\.transportOperatorReference/);
 assert.match(handover,/carrierCompanyReference: references!\.identity!\.carrierCompanyReference/);
 assert.doesNotMatch(handover,/const yourReference = cleanString\(body\.yourReference/);
});
test('Active Reserve PWA shares one lifecycle for status buttons, Undo and timeline',()=>{
 const tl=src('BookingStatusTimeline.tsx');
 const lf=src('reserveLifecycle.ts');
 assert.match(app,/const nextStates = reserveStatusSteps/);
 assert.match(app,/const undoTargets = reserveUndoTargets/);
 assert.match(tl,/reserveTimelineStages as stages, reserveTimelineIndex as indexByStatus/);
 assert.match(tl,/const completed=Boolean\(job\.podRecorded\)/);
 assert.doesNotMatch(tl,/\['DELIVERED','POD_SUBMITTED','COMPLETED'\]\.includes/);
 assert.match(lf,/POD_ARCHIVED/);
});

test('Default static QA build is read-only, including when it shares the production PWA route',()=>{
 const main=src('main.tsx');
 assert.match(main,/VITE_XDRIVE_DRIVER_APPROVED_LIVE_WRITES === '1'/);
 assert.match(main,/location\.origin === 'https:\/\/www\.xdrivelogistics\.co\.uk'/);
 assert.match(main,/const qaMode = !explicitLiveRelease/);
 assert.match(main,/import\.meta\.env\.PROD && !qaMode && 'serviceWorker' in navigator/);
});
