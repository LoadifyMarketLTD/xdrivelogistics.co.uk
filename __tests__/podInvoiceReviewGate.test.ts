import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {hasCompletePodEvidence,isPodApprovedForInvoicing} from '../lib/jobs/podCompletion';
const manual=readFileSync('app/api/driver/finance/jobs/[jobId]/generate-invoice/route.ts','utf8');
const automatic=readFileSync('app/api/_lib/autoGenerateMarketplaceInvoice.ts','utf8');
const complete={pod_generated:true,delivery_photos:['company/job/delivery.jpg'],delivery_signature_data:'data:image/png;base64,YWJj',client_signature_name:'Recipient'};
describe('POD to invoice review safety',()=>{
 it('recognizes complete POD but blocks rejected review',()=>{
   expect(hasCompletePodEvidence(complete)).toBe(true);
   expect(isPodApprovedForInvoicing('rejected')).toBe(false);
   expect(isPodApprovedForInvoicing(' MISSING_REQUESTED ')).toBe(false);
   expect(isPodApprovedForInvoicing('approved')).toBe(true);
   expect(isPodApprovedForInvoicing(null)).toBe(true);
 });
 it('manual invoice creation verifies complete POD and review state before invoice insert',()=>{
   expect(manual).toContain('hasCompletePodEvidence(job)');
   expect(manual).toContain('isPodApprovedForInvoicing(job.broker_pod_review_status)');
   expect(manual).toContain('POD_REVIEW_BLOCKS_INVOICE');
   expect(manual).toContain('pod_generated: job.pod_generated === true');
   expect(manual).toContain('pod_generated_at: cleanText(job.pod_generated_at) || null');
   expect(manual).toContain('pod_photos: Array.from(new Set([');
   expect(manual).toContain('recipient_name: cleanText(job.client_signature_name) || null');
   expect(manual.indexOf('isPodApprovedForInvoicing(job.broker_pod_review_status)')).toBeLessThan(manual.indexOf(".from('invoices')"));
 });
 it('automatic marketplace generation enforces the same POD review gate',()=>{
   expect(automatic).toContain("['delivered', 'completed', 'invoiced'].includes(jobStatus)");
   expect(automatic).toContain('hasCompletePodEvidence(job)');
   expect(automatic).toContain('isPodApprovedForInvoicing(job.broker_pod_review_status)');
   expect(automatic).toContain('broker_pod_review_status');
   expect(automatic.indexOf('isPodApprovedForInvoicing(job.broker_pod_review_status)')).toBeLessThan(automatic.indexOf("rpc('next_invoice_number'"));
 });
});
