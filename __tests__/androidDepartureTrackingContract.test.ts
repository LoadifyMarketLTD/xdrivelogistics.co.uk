import fs from 'node:fs';
import path from 'node:path';

describe('Android departure tracking contract', () => {
  const root = process.cwd();
  const coordinator = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/DepartureTrackingCoordinator.kt'),
    'utf8',
  );
  const guard = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/JobOwnershipGuard.kt'),
    'utf8',
  );
  const app = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/XDriveDriverApp.kt'),
    'utf8',
  );
  const mobileRoute = fs.readFileSync(
    path.join(root, 'app/api/driver/mobile/jobs/[id]/[action]/route.ts'),
    'utf8',
  );

  it('starts the existing foreground tracking runtime from a visible driver action when Android prerequisites are satisfied', () => {
    expect(coordinator).toContain('if (!isAppVisible()) return Outcome.APP_NOT_VISIBLE');
    expect(coordinator).toContain('Manifest.permission.ACCESS_FINE_LOCATION');
    expect(coordinator).toContain('isLocationEnabled');
    expect(coordinator).toContain('ContextCompat.startForegroundService');
    expect(coordinator).toContain('Intent(context, TrackingService::class.java)');
    expect(app).toContain('instance = this');
  });

  it('keeps manual job lifecycle separate from temporary GPS/tracking failures', () => {
    expect(guard).toContain('if (nextStatus == "on_my_way")');
    expect(guard).toContain('DepartureTrackingCoordinator(XDriveDriverApp.instance).startBestEffort()');
    expect(guard).toContain('runCatching');
    expect(guard).toMatch(/startBestEffort\(\)[\s\S]*return null/);
  });

  it('does not add a fresh-GPS server gate that could deadlock On My Way in poor signal', () => {
    expect(mobileRoute).not.toContain('recentLocation');
    expect(mobileRoute).not.toContain('Live tracking must be active before setting On My Way');
    expect(mobileRoute).not.toContain('2 * 60_000');
  });
});
