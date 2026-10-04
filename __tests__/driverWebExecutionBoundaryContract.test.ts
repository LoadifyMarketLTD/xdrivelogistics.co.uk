import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('Driver web/native execution boundary', () => {
  const executionPage = read('app/components/workspace/DriverJobExecutionPage.tsx');
  const webAction = read('app/api/driver/web/jobs/[id]/[action]/route.ts');
  const webEvidence = read('app/api/driver/web/jobs/[id]/evidence/route.ts');
  const webHandover = read('app/api/driver/web/jobs/[id]/handover/route.ts');
  const mobileAction = read('app/api/driver/mobile/jobs/[id]/[action]/route.ts');
  const webLocation = read('app/api/driver/location/route.ts');
  const locationPublisher = read('app/hooks/useDriverLocationPublisher.ts');

  it('keeps Owner Driver browser execution off native device-bound endpoints', () => {
    expect(executionPage).toContain('/api/driver/web/jobs/${encodeURIComponent(jobId)}/evidence');
    expect(executionPage).toContain('/api/driver/web/jobs/${encodeURIComponent(job.id)}/handover');
    expect(executionPage).toContain('/api/driver/web/jobs/${encodeURIComponent(job.id)}/loaded');
    expect(executionPage).toContain('/api/driver/web/jobs/${encodeURIComponent(job.id)}/pod');
    expect(executionPage).not.toContain('/api/driver/mobile/jobs/');
  });

  it('authenticates web execution with the browser driver boundary, not native device binding', () => {
    for (const source of [webAction, webEvidence, webHandover]) {
      expect(source).toContain('requireActiveWebDriver(request)');
      expect(source).toContain('isWebDriverContext(driver)');
      expect(source).not.toContain('requireDriver(request)');
    }
    expect(webAction).not.toContain("getFeatureFlag(supabaseAdmin, 'driver_mobile_app')");
    expect(webEvidence).not.toContain("getFeatureFlag(supabaseAdmin, 'driver_mobile_app')");
    expect(mobileAction).toContain('requireDriver(request)');
  });

  it('publishes browser tracking without requiring a native installation session', () => {
    expect(webLocation).not.toContain('requireActiveNativeAuthSession');
    expect(webLocation).toContain("source: 'driver_web'");
    expect(webLocation).toContain("source_provider: 'browser_geolocation'");
    expect(locationPublisher).toContain('if (!response.ok)');
    expect(locationPublisher).toContain('response.status === 401');
    expect(locationPublisher).toContain('supabase.auth.refreshSession()');
  });
});
