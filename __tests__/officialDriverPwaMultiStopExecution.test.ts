import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

describe('Official Driver PWA multi-stop execution parity', () => {
  const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
  const app = read('official-driver-pwa/src/App.tsx');
  const liveApi = read('official-driver-pwa/src/liveApi.ts');
  const stopUi = read('official-driver-pwa/src/StopExecution.tsx');
  const stopRoute = read('app/api/driver/mobile/jobs/[id]/stop-status/route.ts');
  const parentStatusRoute = read('app/api/driver/mobile/jobs/[id]/status/route.ts');
  const evidenceRoute = read('app/api/driver/mobile/jobs/[id]/evidence/route.ts');
  const podDetails = read('official-driver-pwa/src/PodDetails.tsx');
  const livePod = read('official-driver-pwa/src/LivePodCapture.tsx');
  const lifecycle = read('app/api/driver/mobile/jobs/[id]/[action]/route.ts');
  const stopContract = read('lib/jobs/driverStopExecution.ts');
  const bookingTimeline = read('official-driver-pwa/src/BookingTimeline.tsx');

  test('maps persisted job_stops into the official PWA feed', () => {
    expect(liveApi).toContain('export type LiveStop');
    expect(liveApi).toContain('mapAssignedStop');
    expect(liveApi).toContain('Array.isArray(r.stops)');
    expect(liveApi).toContain('routeStops');
    expect(app).toContain('const routeStops = job?.routeStops ?? []');
    expect(app).toContain('const additionalStops = routeStops.length > 2');
  });

  test('keeps collection lifecycle and first persisted stop synchronized server-side', () => {
    expect(app).toContain("stage: 'arrival'");
    expect(app).toContain("stage: 'loaded'");
    expect(app).toContain('uploadCollectionEvidence');
    expect(app).toContain('Attach at least one collection/loading photo');
    expect(parentStatusRoute).toContain('validateBoundaryStop');
    expect(parentStatusRoute).toContain('applyBoundaryStop');
    expect(parentStatusRoute).toContain("status: 'en_route'");
    expect(parentStatusRoute).toContain("status: 'arrived'");
    expect(parentStatusRoute).toContain("status: 'completed'");
  });

  test('adds the stop execution fields and explicit manual stop actions', () => {
    for (const label of [
      'Your Ref.',
      'Customer Ref.',
      'Number Of Items',
      'Weight (kg)',
      'ETA for this stop',
      'Job Details',
      'Received By (Full Name)',
      'Left At',
      'Delivered On',
      'Delivery Status',
      'Attach files',
      'Add POD',
      'Add More',
      "Driver's Notes",
      'Complete Stop',
      'On My Way to',
      'On Site -',
    ]) expect(stopUi).toContain(label);
    expect(stopUi).toContain('<DeliverySignature');
  });

  test('stores photos, documents and recipient signature inside exact stop evidence scope', () => {
    expect(stopUi).toContain("'x-xdrive-stop-id': stop.id");
    expect(stopUi).toContain("'x-xdrive-evidence-category': category");
    expect(stopUi).toContain("upload(current, signature, 'signature')");
    expect(evidenceRoute).toContain("'signature'");
    expect(evidenceRoute).toContain("category === 'signature' && !stopId");
    expect(stopRoute).toContain('signaturePath');
    expect(stopRoute).toContain("stopEvidencePrefix(driver.companyId, jobId, stopId, 'signature')");
    expect(stopContract).toContain('scopedStopEvidenceObject');
    expect(stopContract).toContain('stopEvidencePrefix');
  });

  test('persists detailed mini-POD data in shared stop handover contract', () => {
    for (const field of [
      'customerReference',
      'itemCount',
      'weightKg',
      'etaAt',
      'recipientName',
      'leftAt',
      'deliveryStatus',
      'deliveredOn',
      'photoPaths',
      'documentPaths',
      'signaturePath',
    ]) expect(stopContract).toContain(field);
    expect(stopRoute).toContain('version: 3');
  });

  test('blocks final delivery until intermediate stops resolve and saves POD before Delivered', () => {
    expect(parentStatusRoute).toContain('Complete or resolve every intermediate stop before travelling to final delivery.');
    expect(lifecycle).toContain('Complete the final POD and resolve every earlier stop before marking the job Delivered.');
    const podSubmit = livePod.indexOf('/pod');
    const completionCallback = livePod.indexOf('await onCompleted(current.token)');
    expect(podSubmit).toBeGreaterThan(-1);
    expect(completionCallback).toBeGreaterThan(podSubmit);
    expect(app).toContain("nextStatus: 'delivered'");
  });

  test('brings final POD fields, canonical outcomes and attachment actions into parity', () => {
    for (const label of ['Delivered On *', 'Delivery Time *', 'Number Of Items *', 'Weight (kg)', 'Delivery Status *']) {
      expect(podDetails).toContain(label);
    }
    for (const outcome of [
      'Completed Delivery',
      'Incorrect Goods',
      'Incorrect Address',
      'Job Cancelled',
      'Delivery Refused',
      'No Unloading Facilities',
      'Damaged Goods',
    ]) expect(podDetails).toContain(outcome);
    expect(livePod).toContain('Add POD');
    expect(livePod).toContain('Add More');
    expect(livePod).toContain('deliveredOn:details.deliveredOn');
    expect(livePod).toContain('deliveredTime:details.deliveredTime');
    expect(livePod).toContain('weightKg:details.weightKg');
    expect(lifecycle).toContain('Delivery weight:');
  });

  test('surfaces real unread driver notifications as Activity without copying CX branding', () => {
    expect(app).toContain('driverGet("/notifications", token)');
    expect(app).toContain('activityUnread');
    expect(app).toContain('Activity');
    expect(app).not.toContain('SmartPay Enabled');
  });

  test('renders stop POD, cancellation, exception and return details from server history', () => {
    expect(app).toContain('<BookingTimeline');
    expect(bookingTimeline).toContain('Received By:');
    expect(bookingTimeline).toContain('Delivered On:');
    expect(bookingTimeline).toContain('Delivery Status:');
    expect(bookingTimeline).toContain("Driver's Notes:");
    expect(bookingTimeline).toContain('Recipient signature recorded');
    expect(bookingTimeline).toContain('Cancelled on Instruction');
    expect(bookingTimeline).toContain('Proof of Return');
    expect(bookingTimeline).toContain('Return Required / Awaiting Instructions');
  });
});
