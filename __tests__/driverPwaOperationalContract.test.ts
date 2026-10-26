import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');

describe('Driver PWA operational wiring', () => {
  it('exports authenticated browser handlers without weakening native device binding', () => {
    const quotes = source('app/api/driver/web/bids/route.ts');
    const quoteMutation = source('app/api/driver/web/bids/[id]/route.ts');
    const resources = source('app/api/driver/web/resources/route.ts');
    const jobDetail = source('app/api/driver/web/jobs/[id]/route.ts');
    const native = source('app/api/driver/mobile/_lib.ts');
    expect(quotes).toContain('export async function GET');
    expect(quotes).toContain('export async function POST');
    expect(quotes).toContain('requireWebDriver(request)');
    expect(quotes).toContain('submitDriverQuote(');
    expect(resources).toContain('export async function GET');
    expect(resources).toContain('export async function POST');
    expect(resources).toContain('requireWebDriver(request)');
    expect(quoteMutation).toContain('export async function POST');
    expect(quoteMutation).toContain('if (!owned)');
    expect(jobDetail).toContain('requireWebDriver(request');
    expect(jobDetail).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(native).toContain('driver_mobile_device_sessions');
  });

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
    const endpoint = source('app/api/driver/web/nearby-jobs/route.ts');
    expect(page).toContain('/api/driver/web/nearby-jobs');
    expect(page).toContain('/api/driver/web/bids');
    expect(endpoint).toContain('publicOutcode');
    expect(endpoint).toContain('fullPostcode: null');
    expect(endpoint).toContain('paymentTerms: row.payment_terms');
    expect(page).toContain('job.paymentTerms');
    expect(page).toContain('job.podRequired');
  });

  it('keeps marketplace job details inside PWA without exposing pre-award addresses', () => {
    const jobs = source('app/m/driver/jobs/page.tsx');
    const quotes = source('app/m/driver/quotes/page.tsx');
    const detail = source('app/m/driver/jobs/[id]/page.tsx');
    const endpoint = source('app/api/driver/web/nearby-jobs/route.ts');
    expect(jobs).toContain('/m/driver/jobs/');
    expect(quotes).toContain('/m/driver/jobs/');
    expect(detail).toContain('nearby-jobs?jobId=');
    expect(detail).toContain('/api/driver/web/bids');
    expect(detail).toContain('job.canQuote !== false');
    expect(endpoint).toContain("query.eq('id', requestedJobId)");
    expect(endpoint).toContain(".in('status', ['posted', 'quoted'])");
    expect(endpoint).toContain(".is('awarded_carrier_company_id', null)");
    expect(endpoint).toContain('fullPostcode: null');
    expect(endpoint).toContain('latitude: null');
    expect(endpoint).toContain('longitude: null');
  });

  it('uses the canonical quote edit/withdraw handler, not local quote status mutation', () => {
    const page = source('app/m/driver/quotes/page.tsx');
    const endpoint = source('app/api/driver/web/bids/[id]/route.ts');
    expect(page).toContain("action === 'withdraw'");
    expect(page).toContain("'edit' | 'withdraw'");
    expect(page).toContain('/api/driver/web/bids/');
    expect(endpoint).toContain("if (action === 'withdraw')");
    expect(endpoint).toContain("if (!owned)");
  });

  it('requires persisted evidence and a signed POD instead of fabricating completion', () => {
    const page = source('app/m/driver/bookings/[id]/page.tsx');
    const evidence = source('app/m/driver/bookings/[id]/BookingEvidence.tsx');
    const server = source('app/api/driver/web/jobs/[id]/[action]/route.ts');
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
    expect(page).toContain('/driver/finance');
    expect(page).toContain('/api/driver/web/resources');
    const resources = source('app/api/driver/web/resources/route.ts');
    expect(resources).toContain("context.driverType?.trim().toLowerCase() === 'owner_driver'");
    expect(resources).toContain('context.canCommercialBid');
  });

  it('clears sensitive driver information on refresh and hides stale results after failure', () => {
    const cases = [
      ['app/m/driver/jobs/page.tsx', 'setJobs([]);setQuoted([])'],
      ['app/m/driver/quotes/page.tsx', 'setQuotes([]);'],
      ['app/m/driver/bookings/page.tsx', 'setCurrentJobs([]);'],
      ['app/m/driver/bookings/[id]/page.tsx', 'setJob(null);'],
      ['app/m/driver/more/page.tsx', 'setData(null);'],
    ];
    for (const [path, guard] of cases) expect(source(path)).toContain(guard);
    expect(source('app/m/driver/quotes/page.tsx')).toContain('!loading && !error && visibleQuotes.map');
    expect(source('app/m/driver/bookings/page.tsx')).toContain('!error && jobs.map');
  });

  it('keeps compliance document viewing and uploads within the scoped mobile PWA', () => {
    const more = source('app/m/driver/more/page.tsx');
    const page = source('app/m/driver/documents/page.tsx');
    const upload = source('app/m/driver/documents/DriverDocumentUpload.tsx');
    expect(more).toContain("href: '/m/driver/documents'");
    const navigation = source('app/m/driver/DriverMobileNavigation.tsx');
    expect(navigation).toContain('isMoreSubview');
    expect(page).toContain('/api/driver/web/documents/');
    expect(page).toContain('<DriverDocumentUpload');
    expect(upload).toContain("action: 'upload_document'");
    expect(upload).toContain("isVehicleDocument: kind === 'vehicle'");
    expect(upload).toContain('file.size > 10 * 1024 * 1024');
  });

  it('uses canonical driver and vehicle document schemas and storage buckets', () => {
    const upload = source('app/m/driver/documents/DriverDocumentUpload.tsx');
    const resources = source('app/api/driver/web/resources/route.ts');
    const signed = source('app/api/driver/web/documents/[id]/route.ts');
    expect(resources).toContain('COMPANY_DRIVER_DOCUMENT_TYPES');
    expect(resources).toContain('OWNER_DRIVER_DOCUMENT_TYPES');
    expect(resources).toContain('VEHICLE_DOCUMENT_TYPES.has(docType)');
    expect(resources).toContain('allowedDriverTypes.has(docType)');
    expect(resources).toContain("isVehicleDocument ? 'vehicle-docs' : 'driver-docs'");
    expect(resources).toContain("file_sha256: createHash('sha256')");
    expect(resources).toContain('(!expiryDate || expiryDate < new Date()');
    expect(signed).toContain("isVehicleDocument ? 'vehicle-docs' : 'driver-docs'");
    expect(upload).toContain("{ value: 'mot', label: 'MOT' }");
    expect(upload).toContain('ownerDriver ?');
    expect(upload).toContain("setDocType(next === 'vehicle' ? 'mot' : 'driving_licence')");
  });
});
