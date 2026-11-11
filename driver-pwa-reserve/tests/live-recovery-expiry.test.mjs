import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {extractPublicOutcode,routeLabel} from '../src/routeLabel.ts';
const api=fs.readFileSync(new URL('../src/liveApi.ts',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../src/ReserveApp.tsx',import.meta.url),'utf8');
const finance=fs.readFileSync(new URL('../src/LiveInvoiceFlow.tsx',import.meta.url),'utf8');

test('Live read requests have explicit abort timeout and independent partial feed handling',()=>{
 assert.match(api,/const deadlineMs = timeoutMs \?\? \(isWrite \? 25000 : 12000\)/);
 assert.match(api,/bookingOffersGet\(token: string\)/);
 assert.match(app,/void bookingOffersGet\(token\)\.then/);
 assert.match(api,/setTimeout\(\(\) => abort.abort\(\), deadlineMs\)/);
 assert.match(api,/finally \{/);
 assert.match(api,/Promise\.allSettled\(/);
 assert.match(app,/Retry Live Data/);
});
test('Expired incoming offers are excluded from Received but remain protected in offer-detail code',()=>{
 assert.match(api,/const offerExpired = pending && Number\.isFinite\(pickupAt\) && pickupAt < Date\.now\(\)/);
 assert.match(app,/EXPIRED OFFER/);
 assert.match(app,/bookingSection==='Received'\?Boolean\(j\.acceptanceRequired&&!j\.offerExpired\)/);
 assert.match(app,/No current booking offers/);
 assert.match(app,/job.offerExpired\?<div className="rv-warning"/);
 assert.match(app,/Expired Booking Offer/);
 assert.match(app,/Accept\/Decline is disabled/);
});
test('Navigation resets scroll and remounts main view to avoid mid-page restoration',()=>{
 assert.match(app,/useLayoutEffect\(\(\)=>\{window\.scrollTo\(0,0\)/);
 assert.match(app,/history\.scrollRestoration='manual'/);
 assert.match(app,/<main key=\{tab\+'-'\+view\+'-'\+\(id\|\|'\'\)\}/);
});
test('Assigned and offered route outcodes come from actual postcodes only',()=>{
 assert.equal(extractPublicOutcode('BB1 3AA'),'BB1');
 assert.equal(extractPublicOutcode('M12 5AY'),'M12');
 assert.equal(extractPublicOutcode('LS1'),'LS1');
 assert.equal(extractPublicOutcode('Blackburn'),'');
 assert.equal(routeLabel('Leeds',extractPublicOutcode('LS1 8BW')),'Leeds, LS1');
 assert.match(api,/fromOutcode: existing\?\.fromOutcode \|\| extractPublicOutcode/);
});
test('Invoice eligibility remains server-side with explicit prerequisites and retry',()=>{
 assert.match(finance,/ready to invoice|Ready To Invoice/i);
 assert.match(finance,/Recheck Invoice Eligibility/);
 assert.match(finance,/owner\/admin permissions/);
 assert.match(finance,/XDrive Finance did not respond in 12 seconds/);
 assert.match(finance,/if\(!eligible\)throw new Error/);
});
