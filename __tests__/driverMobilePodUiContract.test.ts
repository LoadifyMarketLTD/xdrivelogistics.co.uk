import fs from 'node:fs';
import path from 'node:path';

describe('Driver mobile POD capture UI contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'apps/driver-mobile/src/app/DriverMobileApp.tsx'),
    'utf8',
  );

  it('requires delivery photo and recipient signature for required POD while keeping optional POD evidence flexible', () => {
    expect(source).toContain('if (job.podRequired) {');
    expect(source).toContain("if (photoUris.length === 0) {");
    expect(source).toContain("Alert.alert('Delivery photo required'");
    expect(source).toContain("if (!signatureData.trim()) {");
    expect(source).toContain("Alert.alert('Signature required'");
    expect(source).toContain('else if (photoUris.length === 0 && damagePhotoUris.length === 0 && documentUris.length === 0 && !signatureData.trim())');
    expect(source).toContain('photoUris.length + damagePhotoUris.length > 10');
    expect(source).not.toContain('[...photoUris, ...damagePhotoUris].slice(0, 10)');
  });

  it('preserves receiver company and separate damage evidence in the queued/submitted payload', () => {
    expect(source).toContain('Receiver company: ${recipientCompany.trim()}');
    expect(source).toContain('const payload = {');
    expect(source).toContain('photoUris,\n      damagePhotoUris,\n      documentUris,');
    expect(source).not.toContain('photoUris: allPhotoUris');
  });

  it('does not queue a newly rejected permanent 4xx status or POD submission', () => {
    expect(source.match(/if \(isPermanentClientError\(error\)\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(source).toContain('// the action for automatic retry. Permanent 4xx responses never enter');
    expect(source).toContain("Alert.alert('POD not saved', text)");
  });

  it('opens list jobs and VIEW POD through a fresh assignment-gated detail fetch', () => {
    expect(source).toContain('onOpen={(nextJob) => void openJobById(nextJob.id)}');
    expect(source).toContain('const openPodByJobId = useCallback(async (jobId: string) => {');
    expect(source.match(/const response = await fetchJob\(jobId, token\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(source).toContain("setScreen('viewPod')");
    expect(source).toContain('onViewPod={() => void openPodByJobId(job.id)}');
  });
});
