import fs from 'node:fs';
import path from 'node:path';

describe('Driver mobile POD capture UI contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'apps/driver-mobile/src/app/DriverMobileApp.tsx'),
    'utf8',
  );

  it('accepts damage-only POD evidence and enforces a combined photo limit without truncation', () => {
    expect(source).toContain('photoUris.length === 0 && damagePhotoUris.length === 0 && documentUris.length === 0');
    expect(source).toContain('photoUris.length + damagePhotoUris.length > 10');
    expect(source).not.toContain('[...photoUris, ...damagePhotoUris].slice(0, 10)');
  });

  it('preserves receiver company and separate damage evidence in the queued/submitted payload', () => {
    expect(source).toContain('Receiver company: ${recipientCompany.trim()}');
    expect(source).toContain('const payload = {');
    expect(source).toContain('photoUris,\n      damagePhotoUris,\n      documentUris,');
    expect(source).not.toContain('photoUris: allPhotoUris');
  });

  it('opens a job from the list through the assignment-gated detail endpoint', () => {
    expect(source).toContain('onOpen={(nextJob) => void openJobById(nextJob.id)}');
    expect(source).toContain('const response = await fetchJob(jobId, token)');
    expect(source).toContain("setScreen('detail')");
  });
});
