import { describe, expect, it } from 'vitest';
import { canonicalPodEvidence } from '../lib/pod/canonicalPodEvidence';
import { hasCompletePodEvidence, invoicePodBlocker } from '../lib/jobs/podCompletion';
import { signatureReference, signatureEvidenceLabel } from '../lib/pod/jobEvidenceReferences';

const valid = { pod_generated:true, delivery_photos:['company/job/photos/a.jpg'],
  pod_photos:['company/job/documents/pod.pdf'], delivery_signature_data:'company/job/signature.png',
  client_signature_name:'Synthetic receiver' };
const typed = { type:'recipient_typed_name_attestation', signature_method:'typed_name_attestation',
  evidence_path:'company/job/signature/attestation.png' };

describe('XD-AUD-0017C unified POD interpretation', () => {
  it.each([
    ['valid',valid,true],
    ['document only',{...valid,delivery_photos:[]},false],
    ['eleven distinct photos',{...valid,delivery_photos:Array.from({length:11},(_,i)=>'photo-'+i)},false],
    ['ten distinct photos',{...valid,delivery_photos:Array.from({length:10},(_,i)=>'photo-'+i)},true],
    ['duplicates are not extra evidence',{...valid,delivery_photos:Array(11).fill('photo-a')},true],
    ['typed attestation',{...valid,delivery_signature_data:typed},false],
    ['missing recipient',{...valid,client_signature_name:' '},false],
    ['not finalised',{...valid,pod_generated:false},false],
    ['invalid signature',{...valid,delivery_signature_data:'Receiver'},false],
  ] as const)('preserves canonical and invoice parity for %s',(_label,record,expected)=>{
    expect(hasCompletePodEvidence(record)).toBe(expected);
    expect(canonicalPodEvidence(record).complete).toBe(expected);
    expect(invoicePodBlocker(record)===null).toBe(expected);
  });
  it('cannot approve a document-only record',()=>{
    expect(canonicalPodEvidence({...valid,delivery_photos:[],broker_pod_review_status:'approved'}).state).toBe('incomplete');
  });
  it('keeps the evidence readiness flag independent of finalisation',()=>{
    expect(canonicalPodEvidence({...valid,pod_generated:false}).evidenceReady).toBe(true);
  });
  it('does not misrepresent typed evidence as a drawn signature',()=>{
    expect(signatureReference(typed)).toBe(typed.evidence_path);
    const label=signatureEvidenceLabel;
    expect(label(typed)).toBe('Recipient name attestation');
    expect(label(valid.delivery_signature_data)).toBe('Recipient signature');
    expect(label({evidence_path:'company/job/unknown.png'})).toBe('Signature evidence (unverified)');
  });
  it('retains historical signature_data values',()=>{
    expect(signatureReference({signature_data:'data:image/png;base64,AA=='})).toBe('data:image/png;base64,AA==');
  });
});
