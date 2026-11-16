import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('../src/LiveInvoiceFlow.tsx',import.meta.url),'utf8');
test('QA finance: request helper blocks before renewSession and fetch',()=>{const start=src.indexOf('async function req(');const stop=src.indexOf('async function loadDetail(',start);const body=src.slice(start,stop);assert.match(body,/if\(QA_MOCK\) throw new Error/);assert.ok(body.indexOf('if(QA_MOCK)')<body.indexOf('renewSession('));assert.ok(body.indexOf('if(QA_MOCK)')<body.indexOf('fetch('))});
test('QA finance: discovery effect skips Finance API',()=>{assert.match(src,/useEffect\(\(\)=>\{if\(!QA_MOCK\)void discover\(\)/)});
test('QA finance: interactive test preview remains isolated from live invoice mutations',()=>{const qa=src.indexOf('if(QA_MOCK) {');const normal=src.indexOf('const sent=invoice?.delivery_state');assert.ok(qa>0&&normal>qa);const preview=src.slice(qa,normal);assert.match(preview,/Create Invoice - QA Preview/);assert.match(preview,/TEST ONLY/);assert.match(preview,/Create Test Invoice Preview/);assert.doesNotMatch(preview,/onClick=\{\(\)=>void (preview|send|verify|generate)\(\)\}/)});
test('QA finance: normal non-QA actions retained',()=>{for(const name of ['discover','generate','preview','send','verify'])assert.match(src,new RegExp('async function '+name+'\\('))});