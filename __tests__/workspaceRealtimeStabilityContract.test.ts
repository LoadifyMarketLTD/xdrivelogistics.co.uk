import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('workspace realtime and polling stability contract', () => {
  const scheduler = read('app/components/workspace/useVisibleRefresh.ts');
  const workspaceData = read('app/components/workspace/useCompanyWorkspaceData.ts');
  const intelligence = read('app/components/workspace/useOperationsIntelligence.ts');
  const diary = read('app/driver/history/page.tsx');
  const loads = read('app/driver/loads/page.tsx');
  const quotes = read('app/driver/quotes/page.tsx');
  const driverVision = read('app/driver/freight-vision/page.tsx');
  const customerTracking = read('app/customer/CustomerOperationalPages.tsx');
  const protectedRoute = read('app/components/ProtectedRoute.tsx');

  it('centralises visible polling with overlap, visibility, focus, online and minimum-gap guards', () => {
    expect(scheduler).toContain("document.visibilityState !== 'visible'");
    expect(scheduler).toContain('inFlightRef.current');
    expect(scheduler).toContain('lastStartedAtRef.current');
    expect(scheduler).toContain("window.addEventListener('focus'");
    expect(scheduler).toContain("document.addEventListener('visibilitychange'");
    expect(scheduler).toContain("window.addEventListener('online'");
    expect(scheduler).toContain('window.clearInterval(interval)');
  });

  it('uses the shared scheduler for the high-frequency company, Diary, Loads and Quotes surfaces', () => {
    expect(workspaceData).toContain('useVisibleRefresh(refresh');
    expect(diary).toContain('useVisibleRefresh(fetchHistory');
    expect(loads).toContain('useVisibleRefresh(');
    expect(quotes).toContain('useVisibleRefresh(');
    for (const source of [workspaceData, diary, loads, quotes]) {
      expect(source).not.toContain('window.setInterval(refreshIfVisible');
    }
  });

  it('serialises background refreshes and keeps already loaded marketplace/quote rows on transient refresh failures', () => {
    expect(loads).toContain('refreshInFlightRef.current');
    expect(loads).toContain('if (!background) setLoads([])');
    expect(quotes).toContain('refreshInFlightRef.current');
    expect(quotes).toContain('if (!background) setBids([])');
  });

  it('stabilises operations intelligence and tracking snapshots without clearing good background data', () => {
    expect(intelligence).toContain('refreshInFlightRef.current');
    expect(intelligence).toContain("refresh({ background: true })");
    expect(driverVision).toContain('if (!background)');
    expect(driverVision).toContain('else if (background && current[job.id]) next[job.id] = current[job.id]');
    expect(driverVision).toContain("load({ background: true })");
    expect(customerTracking).toContain('trackingRefreshInFlightRef.current');
    expect(customerTracking).toContain('else if (background && current[jobId]) next[jobId] = current[jobId]');
  });

  it('keeps authenticated workspaces mounted during background auth revalidation', () => {
    expect(protectedRoute).toContain('if ((isLoading && !user) || (!user && hasSupabaseSession))');
    expect(protectedRoute).not.toContain('if (isLoading || (!user && hasSupabaseSession))');
  });
});
