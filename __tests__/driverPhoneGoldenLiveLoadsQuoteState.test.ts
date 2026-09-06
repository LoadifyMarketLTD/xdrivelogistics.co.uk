import fs from 'node:fs';
import path from 'node:path';

describe('phone GOLDEN live loads quote-state contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'apps/xdrive-driver-phone-golden/src/api/liveLoads.ts'),
    'utf8',
  );

  it('keeps marketplace reads behind the native device-bound API client', () => {
    expect(source).toContain("apiRequest<LiveLoadsResponse>(`/api/driver/mobile/nearby-jobs");
    expect(source).toContain("apiRequest<{ activeJobIds?: string[] }>('/api/driver/mobile/bids?scope=active-company')");
  });

  it('marks already quoted loads non-quotable instead of removing them', () => {
    expect(source).toContain("quotedJobIds.has(job.id)");
    expect(source).toContain("canQuote: false");
    expect(source).toContain('An active quote already exists for this load. Manage it from Quotes.');
  });

  it('does not expose active ids to recovered callers that used to hide quoted rows', () => {
    expect(source).toContain('export async function fetchActiveQuotedJobIds()');
    expect(source).toContain('return new Set<string>();');
  });
});
