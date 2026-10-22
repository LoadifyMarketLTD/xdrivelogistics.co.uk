import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');

describe('Driver PWA operational wiring', () => {
  it('has four dedicated tab routes and an installable scoped manifest', () => {
    const nav = source('app/m/driver/DriverMobileNavigation.tsx');
    const layout = source('app/m/driver/layout.tsx');
    for (const label of ['Jobs', 'Quotes', 'Bookings', 'More']) {
      expect(nav).toContain(`label: '${label}'`);
    }
    expect(nav).toContain('/m/driver/jobs');
    expect(nav).toContain('/m/driver/quotes');
    expect(nav).toContain('/m/driver/bookings');
    expect(nav).toContain('/m/driver/more');
    expect(layout).toContain('/xdrive-driver.webmanifest');
    const publicManifest = JSON.parse(source('public/xdrive-driver.webmanifest'));
    expect(publicManifest.start_url).toBe('/m/driver/jobs');
    expect(publicManifest.scope).toBe('/m/driver/');
  });

  it('does not cache private booking or quote data in the service worker', () => {
    const worker = source('public/driver-pwa-sw.js');
    const registry = source('app/m/driver/DriverPwaRegistration.tsx');
    expect(registry).toContain("scope: '/m/driver/'");
    expect(worker).toContain("request.mode !== 'navigate'");
    expect(worker).toContain('fetch(request)');
    expect(worker).not.toContain('caches.open(');
    expect(worker).not.toContain('cache.put(');
  });

  it('keeps pre-award Jobs on the public-information API and quotes through the guarded endpoint', () => {
    const page = source('app/m/driver/jobs/page.tsx');
    const endpoint = source('app/api/driver/mobile/nearby-jobs/route.ts');
    expect(page).toContain('/api/driver/mobile/nearby-jobs');
    expect(page).toContain('/api/driver/mobile/bids');
    expect(endpoint).toContain('publicOutcode');
    expect(endpoint).toContain('fullPostcode: null');
    expect(endpoint).toContain('paymentTerms: row.payment_terms');
    expect(page).toContain('job.paymentTerms');
    expect(page).toContain('job.podRequired');
  });

  it('uses the canonical quote edit/withdraw handler, not local quote status mutation', () => {
    const page = source('app/m/driver/quotes/page.tsx');
    const endpoint = source('app/api/driver/mobile/bids/[id]/route.ts');
    expect(page).toContain("action === 'withdraw'");
    expect(page).toContain("'edit' | 'withdraw'");
    expect(page).toContain('/api/driver/mobile/bids/');
    expect(endpoint).toContain("if (action === 'withdraw')");
    expect(endpoint).toContain("if (!owned)");
  });

  it('requires persisted evidence and a signed POD instead of fabricating completion', () => {
    const page = source('app/m/driver/bookings/[id]/page.tsx');
    const evidence = source('app/m/driver/bookings/[id]/BookingEvidence.tsx');
    const server = source('app/api/driver/mobile/jobs/[id]/[action]/route.ts');
    expect(page).toContain('<CollectionHandover');
    expect(page).toContain('<PodCapture');
    expect(page).toContain("perform('undo-status'");
    expect(evidence).toContain("'x-xdrive-evidence-kind'");
    expect(evidence).toContain("'handover'");
    expect(evidence).toContain("'pod'");
    expect(evidence).toContain("toDataURL('image/png')");
    expect(server).toContain('record_driver_pod_atomic');
    expect(server).toContain('requireMultiDropFinalizationReady');
  });

  it('keeps Owner Driver finance tools separate from Company Driver tools', () => {
    const page = source('app/m/driver/more/page.tsx');
    expect(page).toContain("type === 'owner_driver'");
    expect(page).toContain('ownerDriver ?');
    expect(page).toContain("'/driver/finance'");
    expect(page).toContain('/api/driver/mobile/resources');
    const resources = source('app/api/driver/mobile/resources/route.ts');
    expect(resources).toContain("context.driverType?.trim().toLowerCase() === 'owner_driver'");
    expect(resources).toContain('context.canCommercialBid');
  });
});
