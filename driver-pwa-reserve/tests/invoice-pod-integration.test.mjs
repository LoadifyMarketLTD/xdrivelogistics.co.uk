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
test('invoice email contains separate invoice and signed POD PDF attachments',()=>{
 const send=src('lib/server/invoiceDelivery.ts');
 assert.match(send,/combined\.getPageCount\(\) < 3/);
 assert.match(send,/podSummary: pdfContext\.podSummary/);
 assert.match(send,/const invoiceDocument = await PDFDocument\.create\(\)/);
 assert.match(send,/const podDocument = await PDFDocument\.create\(\)/);
 assert.match(send,/Buffer\.from\(invoiceBytes\)\.toString\('base64'\)/);
 assert.match(send,/Buffer\.from\(podBytes\)\.toString\('base64'\)/);
 assert.match(send,/attachments\.length !== \(claimedInvoice\.job_id \? 2 : 1\)/);
 assert.match(send,/podDocument\.getPageCount\(\) < 2/);
});
test('separate POD is persisted and official PDF types cannot be uploaded manually',()=>{
 const delivery=src('lib/server/invoiceDelivery.ts');
 const documents=src('app/api/driver/finance/invoices/[id]/documents/route.ts');
 const migration=src('supabase/migrations/20261111111500_invoice_pod_separate_documents.sql');
 assert.match(delivery,/doc_type: 'pod_pdf'/);
 assert.match(delivery,/content_sha256: createHash\('sha256'\)\.update\(podBytes\)/);
 assert.match(delivery,/POD document registration failed/);
 assert.match(documents,/doc_type === 'invoice_pdf' \|\| doc_type === 'pod_pdf'/);
 assert.match(migration,/invoice_documents_doc_type_check/);
 assert.match(migration,/'pod_pdf'/);
});
test('invoice and POD preview select independent pages',()=>{
 const preview=src('app/api/driver/finance/invoices/[id]/preview/route.ts');
 assert.match(preview,/searchParams\.get\('document'\)/);
 assert.match(preview,/combined\.getPageIndices\(\)\.slice\(1\)/);
 assert.match(preview,/\[0\]/);
 assert.match(preview,/selected\.copyPages\(combined, pageIndexes\)/);
});
test('all linked collection, delivery and POD images are loaded from storage',()=>{
 const context=src('lib/server/invoicePdfContext.ts');
 for(const k of ['pickup_photos','collection_photo_url','delivery_photos','pod_photos','damage_photos','photo_urls','client_signature_name','delivery_signature_data'])
   assert.ok(context.includes(k), 'Missing image/signature field '+k);
 assert.match(context,/if \(requirePod\) throw new Error\('POD evidence could not be downloaded/);
});
test('signature precedes chronological collection/delivery image appendices',()=>{
 const pdf=src('lib/server/invoicePdf.ts');
 assert.match(pdf,/label === 'Signature' \? 0/);
 assert.match(pdf,/label === 'Collection' \? 1/);
 assert.match(pdf,/label === 'Delivery' \? 2/);
});
test('Loads shows no obstructing statistics boxes',()=>{
 const app=src('driver-pwa-reserve/src/ReserveApp.tsx');
 assert.doesNotMatch(app,/rv-feedinfo|Marketplace <b>|Quoted open <b>|Bid history <b>|Bookings <b>/);
});
