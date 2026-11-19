import {describe,it,expect} from 'vitest';
import {invoicePodBlocker, hasCompletePodEvidence} from '../lib/jobs/podCompletion';
const valid={pod_generated:true,delivery_photos:['photo.jpg'],delivery_signature_data:'data:image/png;base64,AAAA',client_signature_name:'QA',broker_pod_review_status:null};
describe('Reserve exact invoice POD eligibility',()=>{
 it('explains why a typed attestation is not a drawn signature',()=>{const record={...valid,delivery_signature_data:{type:'recipient_typed_name_attestation',signature_method:'typed_name_attestation'}};expect(invoicePodBlocker(record)).toBe('DRAWN_SIGNATURE_REQUIRED');expect(hasCompletePodEvidence(record)).toBe(false);});
 it('identifies missing photos, recipient and finalisation',()=>{expect(invoicePodBlocker({...valid,delivery_photos:[]})).toBe('DELIVERY_PHOTOS_REQUIRED');expect(invoicePodBlocker({...valid,client_signature_name:' '})).toBe('RECIPIENT_NAME_REQUIRED');expect(invoicePodBlocker({...valid,pod_generated:false})).toBe('POD_NOT_FINALISED');});
 it('blocks rejected POD and accepts canonical verified evidence',()=>{expect(invoicePodBlocker({...valid,broker_pod_review_status:'rejected'})).toBe('POD_REVIEW_REQUIRED');expect(invoicePodBlocker(valid)).toBeNull();expect(hasCompletePodEvidence(valid)).toBe(true);});
});