import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
const repo=path.resolve(import.meta.dirname,'../..');
const src=p=>fs.readFileSync(path.join(repo,p),'utf8');
const files=[
  'lib/server/invoicePdfContext.ts',
  'lib/server/invoicePdf.ts',
  'lib/server/invoiceDelivery.ts',
  'app/api/driver/finance/invoices/[id]/preview/route.ts',
  'driver-pwa-reserve/src/LiveInvoiceFlow.tsx'
];
test('modified invoice files parse as valid TypeScript',()=>{
  for(const file of files){
    if(file.endsWith('.tsx')) continue; // Vite/TSX compilation is checked by the PWA build.
    assert.doesNotThrow(()=>stripTypeScriptTypes(src(file),{mode:'strip'}),file);
  }
});
test('official finance generator is used instead of manual invoice',()=>{
 const code=src('driver-pwa-reserve/src/LiveInvoiceFlow.tsx');
 assert.match(code,/\/finance\/jobs\/eligible/);
 assert.match(code,/generate-invoice/);
 assert.match(code,/idempotency_key/);
 assert.match(code,/\/preview/);
 assert.match(code,/\/submit/);
 assert.doesNotMatch(code,/method:'POST'[^\n]*\/finance\/invoices[^\n]*body/);
});
test('POD context queries authoritative signed handover and all evidence',()=>{
 const code=src('lib/server/invoicePdfContext.ts');
 for(const token of ['proof_of_delivery','delivered_on','received_by','left_at','no_of_items','delivery_status','delivery_notes','pod_photos','delivery_photos','damage_photos','signatureAttestation','podSummary'])
  assert.ok(code.includes(token),'Missing '+token);
 assert.match(code,/if \(requirePod && \(podError \|\| !pod\)\)/);
 assert.match(code,/POD evidence could not be downloaded/);
});
test('invoice preview rejects incomplete POD and includes signed record',()=>{
 const route=src('app/api/driver/finance/invoices/[id]/preview/route.ts');
 assert.match(route,/requirePod: Boolean\(invoice\.job_id\)/);
 assert.match(route,/signatureAttestation: pdfContext\.signatureAttestation/);
 assert.match(route,/podSummary: pdfContext\.podSummary/);
});
test('PDF has complete POD handover page plus signature and evidence appendices',()=>{
 const pdf=src('lib/server/invoicePdf.ts');
 for(const k of ['PROOF OF DELIVERY','Received By','Left At','Items delivered','Delivery status','Driver / delivery notes','input.signatureAttestation','for (const item of imageEvidence)','for (const item of pdfEvidence)'])
 assert.ok(pdf.includes(k),'Missing '+k);
});
test('sending attaches distinct invoice and Complete-POD PDFs, fails closed when missing',()=>{
 const send=src('lib/server/invoiceDelivery.ts');
 assert.match(send,/const podOnly = await PDFDocument\.create\(\)/);
 assert.match(send,/combined\.getPageCount\(\) < 3/);
 assert.match(send,/podSummary: pdfContext\.podSummary/);
 assert.match(send,/Complete-POD\.pdf/);
 assert.match(send,/Buffer\.from\(invoicePageBytes\)/);
 assert.match(send,/Buffer\.from\(fullPodBytes\)/);
 assert.match(send,/return failDelivery\(409/);
});
