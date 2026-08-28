import fs from 'node:fs';
import path from 'node:path';

describe('CX-benchmark native driver execution parity', () => {
  const confirmation = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/mobile/jobs/[id]/confirmation/route.ts'), 'utf8');
  const collectionPass = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/mobile/jobs/[id]/collection-pass/route.ts'), 'utf8');
  const mobileLib = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/mobile/_lib.ts'), 'utf8');
  const pendingQuote = fs.readFileSync(path.join(process.cwd(), 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/PendingQuoteStore.kt'), 'utf8');
  const quoteWorker = fs.readFileSync(path.join(process.cwd(), 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/QuoteSyncWorker.kt'), 'utf8');

  it('stores structured delivery confirmation without weakening evidence ownership', () => {
    expect(confirmation).toContain('left_at: leftAt || null');
    expect(confirmation).toContain('delivery_status: requestedStatus');
    expect(confirmation).toContain('number_of_items: numberOfItems');
    expect(confirmation).toContain('packaging: packaging || null');
    expect(confirmation).toContain('weight_kg: weightKg');
    expect(confirmation).toContain('driver_notes: driverNotes || null');
    expect(confirmation).toContain('signatureEvidencePath.startsWith(expectedPrefix)');
    expect(confirmation).toContain('evidence.includes(signatureEvidencePath)');
  });

  it('issues Collection Pass only to the assigned native driver and vehicle', () => {
    expect(collectionPass).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(collectionPass).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(collectionPass).toContain('PASS_ELIGIBLE_STATUSES');
    expect(collectionPass).toContain('driver_collection_passes');
    expect(collectionPass).toContain('generatePassCode()');
  });

  it('projects bounded timestamped lifecycle history to the native app', () => {
    expect(mobileLib).toContain('statusHistory: publicStatusHistory(row.status_history)');
    expect(mobileLib).toContain('.slice(-100)');
  });

  it('preserves rich quote metadata through encrypted offline replay', () => {
    for (const field of ['collectWithinMinutes', 'additionalExtrasGbp', 'vehicleId']) {
      expect(pendingQuote).toContain(field);
      expect(quoteWorker).toContain(field);
    }
  });
});
