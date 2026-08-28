import fs from 'node:fs';
import path from 'node:path';

describe('Driver mobile private POD presentation', () => {
  const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
  const presentation = read('app/api/driver/mobile/podPresentation.ts');
  const listRoute = read('app/api/driver/mobile/jobs/route.ts');
  const detailRoute = read('app/api/driver/mobile/jobs/[id]/route.ts');
  const mobileJobs = read('apps/driver-mobile/src/api/jobs.ts');

  it('signs only private tenant/job storage paths and keeps historical read compatibility', () => {
    expect(presentation).toContain('segments[0] === companyId && segments[1] === jobId');
    expect(presentation).toContain(".from('pod-photos')");
    expect(presentation).toContain('.createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)');
    expect(presentation).not.toContain('getPublicUrl');
  });

  it('builds the POD object expected by the Expo viewer', () => {
    expect(presentation).toContain('deliveryPhotoUris:');
    expect(presentation).toContain('damagePhotoUris:');
    expect(presentation).toContain('documentUris:');
    expect(presentation).toContain('receiverName:');
    expect(presentation).toContain('signatureData,');
    expect(presentation).toContain("completedByRole: 'driver'");
  });

  it('adds signed POD presentation to both job list and authorised detail reads', () => {
    expect(listRoute).toContain('buildSignedPodPresentations(rows, driver.companyId)');
    expect(listRoute).toContain('pod: pods.get(row.id) ?? null');
    expect(detailRoute).toContain('buildSignedPodPresentations([row], driver.companyId)');
    expect(detailRoute).toContain('.eq(\'assigned_driver_id\', driver.driverId)');
  });

  it('refreshes detail after successful POD capture so fresh signed URLs reach the UI', () => {
    expect(mobileJobs).toContain('const refreshed = await fetchJob(jobId, token)');
    expect(mobileJobs).toContain('return { ok: true as const, job: refreshed.job }');
  });
});
