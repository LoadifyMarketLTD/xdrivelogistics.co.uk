import fs from 'node:fs';
import path from 'node:path';

describe('Official Driver PWA multi-stop execution parity', () => {
  const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
  const app = read('official-driver-pwa/src/App.tsx');
  const liveApi = read('official-driver-pwa/src/liveApi.ts');
  const stopUi = read('official-driver-pwa/src/StopExecution.tsx');
  const stopRoute = read('app/api/driver/mobile/jobs/[id]/stop-status/route.ts');
  const evidenceRoute = read('app/api/driver/mobile/jobs/[id]/evidence/route.ts');

  test('maps persisted job_stops into the official PWA feed', () => {
    expect(liveApi).toContain('export type LiveStop');
    expect(liveApi).toContain('function mapAssignedStop');
    expect(liveApi).toContain('Array.isArray(r.stops)');
    expect(liveApi).toContain('routeStops');
    expect(app).toContain('const additionalStops = job?.routeStops');
    expect(app).toContain('routeStops.length > 2');
  });

  test('keeps collection lifecycle and first persisted stop synchronized', () => {
    expect(app).toContain("stage: 'arrival'");
    expect(app).toContain("stage: 'loaded'");
    expect(app).toContain('uploadCollectionEvidence');
    expect(app).toContain('At least one collection/loading photo');
    expect(app).toContain('syncPrimaryCollectionStop');
    expect(app).toContain("status: 'arrived'");
    expect(app).toContain("status: 'completed'");
  });

  test('adds the stop completion fields visible in the operational reference flow', () => {
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
    ]) expect(stopUi).toContain(label);
    expect(stopUi).toContain('<DeliverySignature');
  });

  test('stores photos, documents and recipient signature inside the stop evidence scope', () => {
    expect(stopUi).toContain("'x-xdrive-stop-id': stop.id");
    expect(stopUi).toContain("'x-xdrive-evidence-category': category");
    expect(stopUi).toContain("upload(current, signature, 'signature')");
    expect(evidenceRoute).toContain("'signature'");
    expect(evidenceRoute).toContain("category === 'signature' && !stopId");
    expect(stopRoute).toContain("signaturePath");
    expect(stopRoute).toContain("`${base}signature/`");
  });

  test('persists detailed mini-POD data in stop handover JSON without a schema fork', () => {
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
    ]) expect(stopRoute).toContain(field);
    expect(stopRoute).toContain('version: 2');
  });

  test('blocks final delivery until intermediate stops are complete and closes final stop first', () => {
    expect(app).toContain('Complete every intermediate stop before proceeding to final delivery.');
    expect(app).toContain('booking.routeStops[booking.routeStops.length - 1]');
    const finalStopUpdate = app.indexOf("stop_id: finalStop.id");
    const deliveredUpdate = app.indexOf("nextStatus: 'delivered'");
    expect(finalStopUpdate).toBeGreaterThan(-1);
    expect(deliveredUpdate).toBeGreaterThan(finalStopUpdate);
  });

  test('renders completed stop mini-POD details in booking history', () => {
    expect(app).toContain('Completed Stops');
    expect(app).toContain('Received By:');
    expect(app).toContain('Delivered On:');
    expect(app).toContain('Delivery Status:');
    expect(app).toContain("Driver's Notes:");
    expect(app).toContain('Recipient signature recorded');
  });
});
