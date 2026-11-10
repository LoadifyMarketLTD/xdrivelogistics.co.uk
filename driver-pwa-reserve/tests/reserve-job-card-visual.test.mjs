import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync(new URL('../src/ReserveApp.tsx',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../src/ReserveApp.css',import.meta.url),'utf8');
test('Load card prioritises company, service, route, genuine notes and action',()=>{
 const card=app.split('  function card(j:LiveJob)')[1].split('  async function withdrawQuote')[0];
 for(const item of ['rv-job-identity','rv-job-service','<Route job={j}/>','j.notes?.trim()','rv-job-notes','View on Map','Load Details','Quote Now'])assert.ok(card.includes(item),item);
 assert.ok(card.indexOf('rv-job-identity')<card.indexOf('<Route job={j}/>'));
 assert.ok(card.indexOf('<Route job={j}/>')<card.indexOf('rv-job-notes'));
 assert.doesNotMatch(card,/\{j\.yourRef\|\|j\.customerRef\|\|j\.id\}/);
});
test('Job cards have readable typography and no framed inner route',()=>{
 assert.match(css,/\.rv-job\.rv-card\{[^}]*border:0/);
 assert.match(css,/\.rv-job \.rv-route\{[^}]*background:transparent/);
 assert.match(css,/\.rv-job \.rv-stop b\{[^}]*font-size:18px/);
 assert.match(css,/\.rv-job-service/);
 assert.match(css,/\.rv-job-notes/);
});
test('Approved navigation and actions are preserved',()=>{
 assert.match(app,/View on Map/);assert.match(app,/Quote Now/);assert.match(app,/Load Details/);
 assert.match(app,/Withdraw Quote/);assert.match(app,/Edit Quote/);
});
