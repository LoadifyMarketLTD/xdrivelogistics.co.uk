import { describe, expect, it } from 'vitest';
import { jobEvidenceReferences, signatureReference, inlineEvidenceImage, isPodStorageReference, isScopedPodObjectPath } from '../lib/pod/jobEvidenceReferences';

describe('XD-AUD-0017 evidence references', () => {
  it('merges pickup and legacy collection evidence without duplication', () => {
    expect(jobEvidenceReferences({pickup_photos:['a/b/pickup.jpg',null,' ',{},'a/b/pickup.jpg'],collection_photo_url:'a/b/legacy.jpg'}).pickupPhotos)
      .toEqual(['a/b/pickup.jpg','a/b/legacy.jpg']);
    expect(jobEvidenceReferences({pickup_photos:[],collection_photo_url:'a/b/legacy.jpg'}).pickupPhotos).toEqual(['a/b/legacy.jpg']);
    expect(jobEvidenceReferences({pickup_photos:['a/b/legacy.jpg'],collection_photo_url:'a/b/legacy.jpg'}).pickupPhotos).toEqual(['a/b/legacy.jpg']);
  });
  it('keeps evidence categories independent', () => {
    expect(jobEvidenceReferences({delivery_photos:['a/b/photo.jpg'],damage_photos:['a/b/damage.jpg'],pod_photos:['a/b/proof.pdf'],
      delivery_signature_data:{evidence_path:'a/b/signature.png'}})).toEqual({
      pickupPhotos:[],deliveryPhotos:['a/b/photo.jpg'],damagePhotos:['a/b/damage.jpg'],documents:['a/b/proof.pdf'],signature:'a/b/signature.png'});
  });
  it('supports historical inline and object signatures', () => {
    const data='data:image/png;base64,AA==';
    expect(signatureReference(data)).toBe(data);
    expect(signatureReference({value:data,evidence_path:'a/b/sig.png'})).toBe(data);
    expect(signatureReference({evidence_path:'a/b/sig.png'})).toBe('a/b/sig.png');
    expect(signatureReference({value:42})).toBe('');
  });
  it('handles malformed legacy rows without throwing', () => {
    expect(jobEvidenceReferences({pickup_photos:{bad:true},delivery_photos:false,pod_photos:42,delivery_signature_data:[]})).toEqual({
      pickupPhotos:[],deliveryPhotos:[],damagePhotos:[],documents:[],signature:''});
  });
  it.each(['data:image/svg+xml;base64,AA==','data:text/html;base64,AA==','https://example.invalid/a.jpg','javascript:alert(1)'])('does not embed unsafe legacy references %s', value => {
    expect(inlineEvidenceImage(value)).toBe(false);expect(isPodStorageReference(value)).toBe(false);
  });
  it.each(['a/b/../x','a/b/%2e%2e/x','a/b//x','/a/b/x','a/b/x?token=foo','a/b/x\\y','a/b/x#y'])('rejects ambiguous storage paths %s', value => {
    expect(isScopedPodObjectPath(value,'b',['a'])).toBe(false);
  });
  it('binds the path to the exact job and allowed company', () => {
    expect(isScopedPodObjectPath('carrier/b/photos/file.jpg','b',['a','carrier'])).toBe(true);
    expect(isScopedPodObjectPath('carrier/b2/photos/file.jpg','b',['a','carrier'])).toBe(false);
    expect(isScopedPodObjectPath('carrier/b/photos/file.jpg','b',['a'])).toBe(false);
  });
});
