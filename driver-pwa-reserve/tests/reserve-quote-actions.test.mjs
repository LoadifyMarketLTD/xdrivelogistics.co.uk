import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const root=new URL('../src/',import.meta.url);
const read=f=>fs.readFileSync(new URL(f,root),'utf8');
test('Personal bids have ID status ETA and notes, separate from company bids',()=>{
 const src=read('liveApi.ts');
 assert.doesNotThrow(()=>stripTypeScriptTypes(src,{mode:'strip'}));
 for(const s of ['bidId: str(bid.id)','bidStatus: state','quoteEtaMinutes: num(bid.collectWithinMinutes)','quoteNotes: str(bid.message)','personalBid: true'])assert.ok(src.includes(s),s);
});
test('Loads has Load Details, Quote Now or View Quote; Edit and Withdraw remain in Quotes',()=>{
 const app=read('ReserveApp.tsx');
 const card=app.split('  function card(j:LiveJob)')[1].split('  async function withdrawQuote')[0];
 assert.match(card,/tab==='Loads'\?<div className="rv-actions">/);
 assert.match(card,/>Load Details<\/button>/);
 assert.match(card,/>Quote Now<\/button>/);
 assert.match(card,/>View Quote<\/button>/);
 assert.match(card,/tab==='Quotes'\?/);
 assert.doesNotMatch(card,/tab==='Loads'[^\n]*Edit Quote/);
});
test('Quotes has Edit and Withdraw and explicit confirmation, hooked to official API',()=>{
 const app=read('ReserveApp.tsx');
 assert.match(app,/role="alertdialog"/);
 assert.match(app,/rv-primary-quote-actions/);
 const quoteCard=app.split(":tab==='Quotes'?<>")[1]?.split('  async function withdrawQuote')[0]||'';
 assert.ok(quoteCard.indexOf('rv-primary-quote-actions')>=0 && quoteCard.indexOf('rv-primary-quote-actions')<quoteCard.indexOf('View Quote</button>'), 'Edit and Withdraw must appear above View Quote within Quotes cards');
 assert.match(app,/Keep Quote/);
 assert.match(app,/Confirm Withdraw/);
 assert.match(app,/action:'withdraw'/);
 assert.match(app,/driverPost\('\/mobile\/bids\/'\+encodeURIComponent\(j.bidId!\)/);
 assert.match(app,/setQuoteSection\('History'\)/);
 assert.match(app,/personalBid===true/);
});
test('Quotes are split Submitted / History and do not show company-only bids',()=>{
 const list=read('reserveLists.ts');
 assert.match(list,/j\.personalBid===true/);
 assert.match(list,/j\.status==='OPEN' && j\.marketplaceListed===true/);
 const app=read('ReserveApp.tsx');
 assert.match(app,/quoteSection===s/);
 assert.match(app,/\['Submitted','Awarded','History'\]/);
});
test('Edit quote uses existing bid ID, ETA and total; no fake vehicle edit or VAT double count',()=>{
 const app=read('ReserveApp.tsx');
 assert.match(app,/driverPost\('\/mobile\/bids\/'\+encodeURIComponent\(job\.bidId!\)/);
 assert.match(app,/action:'edit'/);
 assert.match(app,/collectWithinMinutes:minutes/);
 assert.match(app,/Save Updated Quote/);
 assert.match(app,/driverPost\('\/mobile\/bids',s\.token/);
 assert.match(app,/Submit Quote/);
 assert.match(app,/total quote \(£, VAT included where applicable\)/);
 assert.doesNotMatch(app,/setQuoteVehicle|setVehicles/);
});