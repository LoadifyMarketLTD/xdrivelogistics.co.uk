import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { collectionReferenceIdentity, collectionTransportIdentity } from '../lib/jobs/collectionReferenceIdentity';

const handover = readFileSync('app/api/driver/mobile/jobs/[id]/handover/route.ts', 'utf8');
const mobile = readFileSync('driver-pwa-reserve/src/ReserveApp.tsx', 'utf8');

describe('XDrive collection: one official job reference + verified transport operator public ID', () => {
  it('uses the personal public profile ID when the performing carrier is an Owner Driver', () => {
    expect(collectionTransportIdentity('db68930a-4488-430e-956b-27eb64f60297','XD-001834','XD-001563','owner_driver')).toEqual({
      jobReference:'XDL-DB68930A',
      carrierCompanyReference:'XD-001834',
      transportOperatorReference:'XD-001563',
      transportOperatorKind:'driver',
    });
  });
  it('uses the company public ID when a driver performs the booking for a carrier company', () => {
    expect(collectionTransportIdentity('db68930a-4488-430e-956b-27eb64f60297','XD-001834','XD-001563','company_driver')).toEqual({
      jobReference:'XDL-DB68930A',
      carrierCompanyReference:'XD-001834',
      transportOperatorReference:'XD-001834',
      transportOperatorKind:'company',
    });
  });
  it('never silently replaces a missing Owner Driver ID with the company ID', () => {
    expect(collectionTransportIdentity('db68930a-4488-430e-956b-27eb64f60297','XD-001834',null,'owner_driver')).toBeNull();
    expect(collectionTransportIdentity('db68930a-4488-430e-956b-27eb64f60297','XD-001834','garbage','owner_driver')).toBeNull();
    expect(collectionTransportIdentity('db68930a-4488-430e-956b-27eb64f60297','XD-001834','XD-001563',null)).toBeNull();
    expect(collectionTransportIdentity('db68930a-4488-430e-956b-27eb64f60297','XD-001834','XD-001563','unknown')).toBeNull();
  });
  it('derives identity from verified company and authenticated operator profile, not form data', () => {
    expect(handover).toContain("supabaseAdmin!.from('profiles').select('xd_id').eq('user_id', userId)");
    expect(handover).toContain("supabaseAdmin!.from('companies').select('xd_id').eq('id', companyId)");
    expect(handover).toContain("getCollectionIdentity(jobId, driver.companyId, driver.userId, driver.driverType)");
    expect(mobile).toContain("readOnly aria-readonly=\"true\" value={carrierReference}");
    expect(mobile).toContain("carrierOperatorKind==='driver'?'XDrive Owner Driver ID':'XDrive Carrier Company ID'");
    expect(mobile).not.toContain('label="Cust Ref."');
  });
  it('prepares the same public values as the real DB records for the completed test job', () => {
    expect(collectionReferenceIdentity('db68930a-4488-430e-956b-27eb64f60297','XD-001834'))
      .toEqual({jobReference:'XDL-DB68930A', carrierCompanyReference:'XD-001834'});
  });
  it('supports both uppercase and lowercase UUID input', () => {
    expect(collectionReferenceIdentity('C0E098F3-A5F2-4B64-BF52-E129B3192947','xd-001834'))
      .toEqual({jobReference:'XDL-C0E098F3', carrierCompanyReference:'XD-001834'});
  });
  it('fails closed if the company ID is missing or the job ID is not a UUID', () => {
    expect(collectionReferenceIdentity('db68930a-4488-430e-956b-27eb64f60297',null)).toBeNull();
    expect(collectionReferenceIdentity('db68930a-4488-430e-956b-27eb64f60297','3754b8fd-2ee1-42cf-a172-309058c5dc04')).toBeNull();
    expect(collectionReferenceIdentity('not-a-job','XD-001834')).toBeNull();
    expect(collectionReferenceIdentity('db68930a-4488-430e-956b-27eb64f60297','')).toBeNull();
  });
  it('gets carrier ID from the authenticated assigned company rather than client-supplied fields', () => {
    expect(handover).toContain(".from('companies')");
    expect(handover).toContain(".select('xd_id').eq('id', companyId).maybeSingle()");
    expect(handover).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(handover).toContain("job.assigned_company_id !== driver.companyId");
    expect(handover).toContain("data.assigned_company_id !== driver.companyId");
    expect(handover).toContain("collectionTransportIdentity(jobId, company?.xd_id, profile.data?.xd_id, driverType)");
    expect(handover).not.toContain('const yourReference = cleanString(body.yourReference');
    expect(handover).not.toContain('const customerReference = cleanString(body.customerReference');
  });
  it('includes uneditable official references in GET so an existing handover cannot spoof them', () => {
    expect(handover).toContain('references: references.identity');
    expect(mobile).toContain('setYourReference(refs.jobReference)');
    expect(mobile).toContain('setCarrierReference(refs.transportOperatorReference)');
    expect(mobile).toContain('setCarrierOperatorKind(refs.transportOperatorKind)');
    expect(mobile).not.toContain("setYourReference(String(h.loaded.yourReference||''))");
  });
  it('stores carrier ID separately from posting customer reference', () => {
    expect(handover).toContain('carrierCompanyReference: references!.identity!.carrierCompanyReference');
    expect(handover).toContain('transportOperatorReference: references!.identity!.transportOperatorReference');
    expect(handover).toContain('transportOperatorKind: references!.identity!.transportOperatorKind');
    expect(handover).toContain('jobReference: references!.identity!.jobReference');
    expect(handover).toContain('customerReference: cleanString(job.customer_reference || job.customer_ref, 120)');
    expect(handover).toContain('yourReference: references!.identity!.jobReference');
  });
  it('renders auto-filled fields read-only with explicit meaning, without manual input or client-supplied identity on POST', () => {
    expect(mobile).toContain('label="XDrive Job Reference"');
    expect(mobile).toContain("carrierOperatorKind==='driver'?'XDrive Owner Driver ID':'XDrive Carrier Company ID'");
    expect(mobile).toContain('readOnly aria-readonly="true" value={yourReference}');
    expect(mobile).toContain('readOnly aria-readonly="true" value={carrierReference}');
    expect(mobile).not.toContain('label="Customer Reference (optional)"');
    expect(mobile).not.toContain('yourReference:yourReference.trim()');
    expect(mobile).not.toContain('customerReference:customerReference.trim()');
  });
  it('refuses to complete loading when verified identifiers have not been received', () => {
    expect(mobile).toContain("if(!yourReference||!carrierReference)throw new Error('XDrive job reference and carrier ID must be loaded from the server before saving.");
    expect(handover).toContain("if (references?.error || (stage === 'loaded' && !references?.identity))");
  });
});
