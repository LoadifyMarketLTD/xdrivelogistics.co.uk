import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { selectOfficialPodSignatureImage } from '../lib/pod/officialPodSignatureImage';

const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScDQeQAAAABJRU5ErkJggg==';
const job='db68930a-4488-430e-956b-27eb64f60297';
const driver='9fe67b29-0c3f-459e-b968-eef703b00748';
const name='QA TEST RECIPIENT';
const generated='2026-11-16T22:05:59Z';
const attestation={
 type:'recipient_typed_name_attestation',
 job_id:job,
 driver_id:driver,
 evidence_path:'carrier/'+job+'/photos/proof.jpg',
 confirmed_at:'2026-11-16T14:00:13Z',
 signature_method:'typed_name_attestation'
};
const savedDraft={
 driver_id:driver,updated_at:'2026-11-16T14:00:10Z',
 form_data:{recipientName:name,signatureData:image,deliveredOn:'2026-11-16',leftAt:'Goods Inwards'}
};
const basic={
 storedSignature:attestation,savedDraft,jobId:job,assignedDriverId:driver,
 recipientName:name,podGeneratedAt:generated
};
describe('Immutable official POD PDF: legacy typed-name attestation with existing real drawing',()=>{
 it('keeps an original, valid image without requiring a draft',()=>{
   expect(selectOfficialPodSignatureImage({...basic,storedSignature:image,savedDraft:null})).toBe(image);
 });
 it('keeps a verified image stored within the signature envelope',()=>{
   expect(selectOfficialPodSignatureImage({...basic,storedSignature:{value:image},savedDraft:null})).toBe(image);
 });
 it('recovers a preexisting saved drawing for an exact signed test-job attestation',()=>{
   expect(selectOfficialPodSignatureImage(basic)).toBe(image);
 });
 it('rejects another recipient draft',()=>{
   expect(selectOfficialPodSignatureImage({...basic,savedDraft:{...savedDraft,form_data:{...savedDraft.form_data,recipientName:'SOMEONE ELSE'}}})).toBeNull();
 });
 it('rejects a driver mismatch',()=>{
   expect(selectOfficialPodSignatureImage({...basic,savedDraft:{...savedDraft,driver_id:'another-driver'}})).toBeNull();
   expect(selectOfficialPodSignatureImage({...basic,storedSignature:{...attestation,driver_id:'another-driver'}})).toBeNull();
 });
 it('rejects another job or cross-job evidence path',()=>{
   expect(selectOfficialPodSignatureImage({...basic,storedSignature:{...attestation,job_id:'another-job'}})).toBeNull();
   expect(selectOfficialPodSignatureImage({...basic,storedSignature:{...attestation,evidence_path:'carrier/another-job/photos/old.jpg'}})).toBeNull();
 });
 it('rejects drafts updated after the official POD was signed',()=>{
   expect(selectOfficialPodSignatureImage({...basic,savedDraft:{...savedDraft,updated_at:'2026-11-17T12:00:00Z'}})).toBeNull();
 });
 it('rejects an attestation confirmed later than the official POD',()=>{
   expect(selectOfficialPodSignatureImage({...basic,storedSignature:{...attestation,confirmed_at:'2026-11-17T12:00:00Z'}})).toBeNull();
 });
 it('does not invent a signature without a completed POD timestamp',()=>{
   expect(selectOfficialPodSignatureImage({...basic,podGeneratedAt:null})).toBeNull();
 });
 it('rejects malformed or fake image bytes',()=>{
   expect(selectOfficialPodSignatureImage({...basic,savedDraft:{...savedDraft,form_data:{recipientName:name,signatureData:'data:image/png;base64,aGVsbG8='}}})).toBeNull();
 });
 it('does not use a draft for an unverified envelope type',()=>{
   expect(selectOfficialPodSignatureImage({...basic,storedSignature:{...attestation,type:'unknown'}})).toBeNull();
 });
 it('does not accept a typed-name attestation without a driver-scoped stored drawing',()=>{
   expect(selectOfficialPodSignatureImage({...basic,savedDraft:null})).toBeNull();
 });
 it('PDF route keeps authentication and proof gates, and uses read-only historical signed draft for the image',()=>{
   const src=readFileSync('app/api/workspace/jobs/[jobId]/pod/pdf/route.ts','utf8');
   expect(src).toContain('if (!authorised) return jsonError(403');
   expect(src).toContain('if (!evidence.complete) return jsonError(409');
   expect(src).toContain("select('form_data,driver_id,updated_at')");
   expect(src).toContain('selectOfficialPodSignatureImage({');
   expect(src).toContain('assignedDriverId: job.assigned_driver_id');
   expect(src).toContain('podGeneratedAt: job.pod_generated_at');
   expect(src).not.toContain("String((storedSignature as Record<string, unknown>).value ?? '')");
 });
});
