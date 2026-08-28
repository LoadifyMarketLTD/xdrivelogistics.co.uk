import fs from 'node:fs';
import path from 'node:path';

describe('Driver mobile POD cleanup ordering', () => {
  const jobsClient = fs.readFileSync(
    path.join(process.cwd(), 'apps/driver-mobile/src/api/jobs.ts'),
    'utf8',
  );

  it('retains durable offline evidence until the authorised detail refresh succeeds', () => {
    const refresh = jobsClient.lastIndexOf('const refreshed = await fetchJob(jobId, token)');
    const cleanup = jobsClient.lastIndexOf('await cleanupPersistedPodPayload(metadata)');
    expect(refresh).toBeGreaterThan(-1);
    expect(cleanup).toBeGreaterThan(refresh);
  });
});
