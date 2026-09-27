import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getVisibleWorkspaceNav } from '../lib/workspaceRole';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
const hrefs = (role: 'customer' | 'broker' | 'carrier_admin' | 'fleet_manager' | 'driver' | 'owner_driver') =>
  getVisibleWorkspaceNav(role).flatMap((group) => group.items.map((item) => item.href));

describe('six-role canonical blueprint completion', () => {
  it('exposes Customer documents, invoices and notifications alongside core transport modules', () => {
    const nav = hrefs('customer');
    for (const route of ['/customer/loads','/customer/quotes','/customer/bookings','/customer/tracking','/customer/documents','/customer/invoices','/customer/disputes','/customer/diary','/customer/network','/customer/messages','/customer/notifications','/customer/event-log']) {
      expect(nav).toContain(route);
    }
    const operations = read('app/customer/CustomerOperationalPages.tsx');
    expect(operations).toContain('/api/tracking/jobs/${encodeURIComponent(job.id)}');
    expect(operations).toContain('TRACKING / ETA');
    expect(operations).toContain('Live ETA unavailable until an approved tracking snapshot is available');
  });

  it('exposes Broker reports with finance, POD, messaging and carrier sourcing workflow', () => {
    const nav = hrefs('broker');
    for (const route of ['/broker/enquiries','/broker/loads','/broker/bids','/broker/jobs','/broker/pod-review','/broker/carrier-network','/broker/diary','/broker/messages','/broker/event-log','/broker/disputes','/broker/finance','/broker/reports']) {
      expect(nav).toContain(route);
    }
    const reports = read('app/broker/reports/page.tsx');
    expect(reports).toContain('Reports & Exports');
    expect(reports).toContain('Export CSV');
    expect(reports).toContain('Report data is unavailable or partial');
  });

  it('exposes Carrier Won Work and POD as first-class routes', () => {
    const nav = hrefs('carrier_admin');
    for (const route of ['/admin/marketplace','/admin/exchange-quotes','/admin/won-work','/admin/jobs','/admin/pod','/admin/fleet/assignments','/admin/drivers','/admin/vehicles','/admin/live-availability','/admin/fleet','/admin/fleet/returns','/admin/marketplace/directory','/admin/freight-vision','/admin/invoices','/admin/documents','/admin/messages','/admin/event-log']) {
      expect(nav).toContain(route);
    }
    expect(read('app/admin/won-work/page.tsx')).toContain('initialTab="won"');
  });

  it('keeps Fleet Manager operational without business ownership navigation', () => {
    const nav = hrefs('fleet_manager');
    for (const route of ['/admin/fleet/drivers','/admin/fleet/vehicles','/admin/fleet/availability','/admin/fleet/future-availability','/admin/fleet/assignments','/admin/fleet/jobs','/admin/fleet/positions','/admin/fleet/returns','/admin/fleet/compliance','/admin/incidents','/admin/freight-vision','/admin/invoices','/admin/messages']) {
      expect(nav).toContain(route);
    }
    expect(nav).not.toContain('/settings/billing');
    expect(nav).not.toContain('/admin/settings');
    expect(nav).not.toContain('/admin/fleet/managers');
  });

  it('exposes Owner Driver commercial matching, tracking, returns, finance, messaging and directory', () => {
    const nav = hrefs('owner_driver');
    for (const route of ['/driver/loads','/driver/quotes','/driver/won-work','/driver/load-alerts','/driver/availability','/driver/returns','/driver/nearby','/driver/freight-vision','/driver/history','/driver/finance','/driver/messages','/driver/directory']) {
      expect(nav).toContain(route);
    }
  });

  it('keeps employed Driver execution-only while supporting complete evidence capture', () => {
    const nav = hrefs('driver');
    for (const route of ['/driver/jobs','/driver/history','/driver/availability','/driver/vehicles','/driver/documents','/driver/messages']) expect(nav).toContain(route);
    for (const forbidden of ['/driver/loads','/driver/quotes','/driver/finance','/driver/load-alerts','/settings/billing','/driver/drivers-vehicles']) expect(nav).not.toContain(forbidden);

    const execution = read('app/components/workspace/DriverJobExecutionPage.tsx');
    expect(execution).toContain('multiple hidden onChange={selectCollectionPhotos}');
    expect(execution).toContain('multiple hidden onChange={selectDeliveryPhotos}');
    expect(execution).toContain('Recipient full name');
    expect(execution).toContain('signatureRef');
    expect(execution).toContain('Google Maps');
    expect(execution).toContain('Waze');
    expect(execution).toContain('Driver operational notes');

    const collectionApi = read('app/api/driver/jobs/[jobId]/collection-evidence/route.ts');
    expect(collectionApi).toContain('requireActiveWebDriver(request)');
    expect(collectionApi).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(collectionApi).toContain('pickup_photos: merged');
    expect(collectionApi).toContain('collection_photo_url: legacyPhoto');
  });
});
