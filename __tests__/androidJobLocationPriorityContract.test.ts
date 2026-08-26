import fs from 'node:fs';
import path from 'node:path';

describe('Android active-job location priority contract', () => {
  const root = process.cwd();
  const tracking = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/TrackingService.kt'),
    'utf8',
  );

  it('uses high accuracy for mandatory active-job tracking', () => {
    expect(tracking).toContain('captureCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY)');
  });

  it('keeps pre-job availability battery-aware', () => {
    expect(tracking).toContain('captureCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY)');
  });

  it('passes the chosen priority explicitly to fused location', () => {
    expect(tracking).toContain('private suspend fun captureCurrentLocation(priority: Int)');
    expect(tracking).toContain('fusedClient.getCurrentLocation(\n            priority,');
  });
});
