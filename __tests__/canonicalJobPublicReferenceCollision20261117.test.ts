import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  shortHistoricalJobReference, fullUnambiguousJobReference, verifiedJobPublicReference,
} from '../lib/jobs/jobPublicReference';
import { collectionReferenceIdentity, verifiedCollectionCommercialActorId } from '../lib/jobs/collectionReferenceIdentity';
import { historicalJobAliases, selectHistoricalJobMatches } from '../lib/jobs/historicalReferenceLookup';

const first = 'e2e00000-0000-4000-8000-000000000001';
const second = 'e2e00000-0000-4000-8000-000000000010';
const carrier = 'XD-001835';
const source = (file: string) => readFileSync(file, 'utf8');
const migration = source('supabase/migrations/20261117153741_unique_xdrive_job_public_references.sql');
const collection = source('app/api/driver/mobile/jobs/[id]/handover/route.ts');
const driverLib = source('app/api/driver/mobile/_lib.ts');

describe('XDrive job reference identity (without altering historical customer references)', () => {
  it('reproduces the genuine short-reference collision in two independent historical jobs', () => {
    expect(first).not.toBe(second);
    expect(shortHistoricalJobReference(first)).toBe('XDL-E2E00000');
    expect(shortHistoricalJobReference(second)).toBe('XDL-E2E00000');
    expect(fullUnambiguousJobReference(first)).not.toBe(fullUnambiguousJobReference(second));
  });

  it('accepts only the stored official reference belonging to that exact job', () => {
    expect(verifiedJobPublicReference(first, 'XDL-E2E00000')).toBe('XDL-E2E00000');
    expect(verifiedJobPublicReference(second, fullUnambiguousJobReference(second))).toBe(fullUnambiguousJobReference(second));
    expect(verifiedJobPublicReference(first, fullUnambiguousJobReference(second))).toBeNull();
    expect(verifiedJobPublicReference(first, 'XDL-OTHER')).toBeNull();
    expect(verifiedJobPublicReference('not-a-uuid', 'XDL-E2E00000')).toBeNull();
  });

  it('uses the server-owned disambiguated job reference on Collection, never the user body', () => {
    expect(collectionReferenceIdentity(second, carrier, fullUnambiguousJobReference(second))).toEqual({
      jobReference: fullUnambiguousJobReference(second),
      carrierCompanyReference: carrier,
    });
    expect(collectionReferenceIdentity(second, carrier, fullUnambiguousJobReference(first))).toBeNull();
    expect(collection).toContain(".from('xdrive_job_references').select('public_reference')");
    expect(collection).toContain('collectionReferenceIdentity(jobId, publicId, referenceRow.public_reference)');
    expect(collection).not.toContain('const yourReference = cleanString(body.yourReference');
  });

  it('never confuses the commercial company XD ID with the job or poster private reference', () => {
    expect(verifiedCollectionCommercialActorId('company_driver', 'XD-001835', 'XD-001871')).toBe('XD-001835');
    expect(verifiedCollectionCommercialActorId('owner_driver', 'XD-001834', 'XD-001834')).toBe('XD-001834');
    expect(verifiedCollectionCommercialActorId('owner_driver', 'XD-001834', 'XD-001563')).toBeNull();
    expect(collection).toContain('carrierCompanyReference: references!.identity!.carrierCompanyReference');
    expect(collection).toContain('customerReference: cleanString(job.customer_reference || job.customer_ref, 120)');
  });

  it('preserves both the old short job alias and official unique reference in scoped searches', () => {
    const jobs = [
      { id: first, customer_reference: 'E2E-EDIT-001', xdrive_job_references: { public_reference: 'XDL-E2E00000' } },
      { id: second, customer_reference: 'E2E2-EDIT-001', xdrive_job_references: { public_reference: fullUnambiguousJobReference(second)! } },
    ];
    expect(historicalJobAliases(jobs[1])).toContain('XDL-E2E00000');
    expect(historicalJobAliases(jobs[1])).toContain(fullUnambiguousJobReference(second));
    expect(selectHistoricalJobMatches(jobs, fullUnambiguousJobReference(second)!)).toEqual([jobs[1]]);
    expect(selectHistoricalJobMatches(jobs, 'E2E2-EDIT-001')).toEqual([jobs[1]]);
    expect(selectHistoricalJobMatches(jobs, 'XDL-E2E00000')).toHaveLength(2);
    expect(jobs[1].customer_reference).toBe('E2E2-EDIT-001');
  });

  it('projects the reference registry into every driver list/detail query using the shared jobSelect', () => {
    expect(driverLib).toContain("'xdrive_job_references(public_reference)'");
    expect(driverLib).toContain('verifiedJobPublicReference(row.id, row.xdrive_job_references?.public_reference)');
  });

  it('assigns exactly one immutable public reference per job with concurrency protection', () => {
    expect(migration).toContain('job_id uuid primary key references public.jobs(id)');
    expect(migration).toContain('public_reference text not null unique');
    expect(migration).toContain('pg_catalog.pg_advisory_xact_lock');
    expect(migration).toContain('after insert on public.jobs');
    expect(migration).toContain('trg_xdrive_job_public_reference_immutable');
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('grant select on table public.xdrive_job_references to service_role;');
    expect(migration).not.toContain('update public.jobs');
    expect(migration).not.toContain('update public.invoices');
  });
});
