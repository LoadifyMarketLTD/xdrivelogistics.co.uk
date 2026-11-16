'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const page=read('app/driver/quotes/page.tsx');
const modal=read('app/components/workspace/MarketplaceQuoteNowDialog.tsx');
const tests=[
 ['quotes query fetches updated timestamp',()=>assert.match(page,/bidder_archived_at, created_at, updated_at/)],
 ['latest update is labelled accurately in quote cards',()=>{assert.match(page,/You Quoted \$\{quoteAmount\} · last updated/);assert.match(page,/cxShortWhen\(bid\.updated_at \?\? bid\.created_at\)/)}],
 ['quote register renders before slow booking-offer enrichment',()=>assert.match(page,/setBids\(allRows\);\s*\/\/ Render the authenticated quote register[\s\S]*?setLoading\(false\);\s*const token=readRouteAuthAccessToken/)],
 ['withdrawal fails closed while offer status is unverified',()=>{assert.match(page,/setOffersVerified\(false\)/);assert.match(page,/setOffersVerified\(true\)/);assert.match(page,/const activeQuote = offersVerified &&/)}],
 ['quote vehicle UI never displays an unpopulated mandatory selector',()=>{assert.match(modal,/vehicleOptions\.length > 0 \?/);assert.match(modal,/Your assigned active vehicle is checked automatically/)}],
 ['modal submission still validates amount and ETA',()=>assert.match(modal,/working \|\| !\(Number\(amount\) > 0\) \|\| !\(total > 0\) \|\| !eta/)]
];
let pass=0;for(const [name,fn] of tests){try{fn();pass++;console.log('PASS '+name)}catch(e){console.log('FAIL '+name+' '+String(e.message||e).slice(0,200))}}
console.log('OWNER_LIVE_QUOTE_REGRESSIONS='+pass+'/'+tests.length);
if(pass!==tests.length)process.exitCode=1;
