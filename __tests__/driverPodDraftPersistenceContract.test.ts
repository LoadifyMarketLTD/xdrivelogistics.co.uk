import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const api = read('app/api/driver/web/jobs/[id]/pod-draft/route.ts');
const page = read('app/components/workspace/DriverJobExecutionPage.tsx');
const screen = read('app/driver-pwa-fresh/bookings/[id]/pod/page.tsx');
const migration = read('supabase/migrations/20261028035400_driver_pod_draft_persistence.sql');
const podAction = read('app/api/driver/web/jobs/[id]/[action]/route.ts');

describe('driver PWA persistent mobile POD contract', () => {
  it('limits draft reads and writes to the assigned authenticated driver', () => {
    expect(api).toContain('requireActiveWebDriver(request)');
    expect(api).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(api).toContain(".eq('driver_id', access.driver.driverId)");
    expect(api).toContain("if (access.job.pod_generated)");
  });
  it('stores drafts privately and separately from the canonical final POD', () => {
    expect(migration).toContain('create table if not exists public.driver_pod_drafts');
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('revoke all on public.driver_pod_drafts from anon, authenticated');
    expect(migration).toContain("grant all on public.driver_pod_drafts to service_role");
    expect(api).toContain("onConflict: 'job_id'");
  });
  it('provides a mobile-only POD route with server draft recovery', () => {
    expect(screen).toContain('mobilePwa podOnly');
    expect(screen).toContain('Back to booking');
    expect(screen).not.toContain('Navigate');
    expect(page).toContain('Save Signature');
    expect(page).toContain("method: 'PUT'");
    expect(page).toContain('podDraftSaveQueue.current');
  });
  it('prevents a partial or repeated POD from creating false final completion', () => {
    expect(podAction).toContain('job.pod_generated === true');
    expect(podAction).toContain("deliveryStatus !== 'Completed Delivery'");
    expect(podAction).toContain('alreadySubmitted: true');
  });
});
