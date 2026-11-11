import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

describe('canonical Driver test routing', () => {
  it('keeps real Driver workspace and mobile entry points', () => {
    for (const path of ['app/driver/jobs/page.tsx', 'app/driver/quotes/page.tsx', 'app/driver/finance/page.tsx', 'app/driver/official-pwa-live/page.tsx', 'app/components/workspace/DriverJobExecutionPage.tsx']) {
      expect(existsSync(path), path).toBe(true);
    }
  });
  it('does not reintroduce removed legacy booking and visual-preview routes', () => {
    for (const path of ['app/driver-pwa-fresh/bookings/page.tsx', 'app/driver-pwa-fresh/bookings/offers/[id]/page.tsx', 'app/driver-pwa-fresh/visual-preview/workflow/page-0/page.tsx']) {
      expect(existsSync(path), path).toBe(false);
    }
  });
  it('keeps the POD and invoice lifecycle in the live execution component', () => {
    const source = readFileSync('app/components/workspace/DriverJobExecutionPage.tsx', 'utf8');
    expect(source).toContain('hasCompletePodEvidence(job)');
    expect(source).toContain('Complete required POD');
    expect(source).toContain('Create Invoice');
  });
});
