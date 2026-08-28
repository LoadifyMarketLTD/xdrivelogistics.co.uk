import fs from 'node:fs';
import path from 'node:path';

describe('Driver mobile lifecycle and POD replay contracts', () => {
  const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
  const mobileLib = read('app/api/driver/mobile/_lib.ts');
  const jobsClient = read('apps/driver-mobile/src/api/jobs.ts');
  const evidenceRoute = read('app/api/driver/mobile/jobs/[id]/evidence/route.ts');

  it('normalizes every canonical execution and finance terminal status into the Expo vocabulary', () => {
    expect(mobileLib).toContain("current === 'assigned' || current === 'accepted' || current === 'allocated'");
    expect(mobileLib).toContain("current === 'on_my_way' || current === 'on_my_way_to_pickup'");
    expect(mobileLib).toContain("current === 'on_site_pickup' || current === 'arrived_pickup'");
    expect(mobileLib).toContain("current === 'in_transit' || current === 'on_route_delivery' || current === 'on_my_way_to_delivery'");
    expect(mobileLib).toContain("current === 'on_site_delivery' || current === 'arrived_delivery'");
    expect(mobileLib).toContain("if (current === 'invoiced') return 'invoice_generated'");
    expect(mobileLib).toContain("if (current === 'paid') return 'completed'");
  });

  it('uses a stable evidence namespace so upload response loss cannot create duplicate POD objects', () => {
    expect(jobsClient).toContain('safeEvidenceBatchId(metadata.evidenceBatchId)');
    expect(jobsClient).toContain('metadata.evidenceBatchId = batchId');
    expect(jobsClient).toContain('evidenceObjectName(batchId, kind, index, extension)');
    expect(jobsClient).toContain('legacyEvidenceBatchId(jobId, metadata)');
    expect(jobsClient).not.toContain('const objectName = `${uniqueName()}');
    expect(evidenceRoute).toContain("const duplicate = text.includes('already exists') || text.includes('duplicate')");
    expect(evidenceRoute).toContain("return respond(200, { ok: true, storagePath })");
  });

  it('keeps a new online POD capture in one idempotency batch before any evidence upload begins', () => {
    const batchAssignment = jobsClient.indexOf('metadata.evidenceBatchId = batchId');
    const firstPersist = jobsClient.indexOf('persistPodFiles(jobId');
    expect(batchAssignment).toBeGreaterThan(-1);
    expect(firstPersist).toBeGreaterThan(batchAssignment);
  });
});
