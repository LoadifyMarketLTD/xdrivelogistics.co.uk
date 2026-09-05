import fs from 'node:fs';
import path from 'node:path';

describe('Android active-job tracking lifecycle contract', () => {
  const root = process.cwd();
  const app = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/XDriveDriverApp.kt'),
    'utf8',
  );
  const api = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/data/TrackingStateApi.kt'),
    'utf8',
  );
  const manifest = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/AndroidManifest.xml'),
    'utf8',
  );
  const route = fs.readFileSync(
    path.join(root, 'app/api/driver/tracking-state/route.ts'),
    'utf8',
  );
  const service = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/TrackingService.kt'),
    'utf8',
  );
  const departure = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/DepartureTrackingCoordinator.kt'),
    'utf8',
  );

  it('uses server-authoritative single-active-job eligibility', () => {
    expect(route).toContain('const ACTIVE_JOB_STATUSES = new Set([');
    expect(route).toContain(".eq('assigned_driver_id', driver.id)");
    expect(route).toContain('if (activeJobs.length !== 1)');
    expect(route).toContain('should_track: true');
    expect(route).toContain("reason: activeJobs.length === 0 ? 'no_active_job' : 'multiple_active_jobs'");
  });

  it('starts/reconciles the location runtime from a visible Activity state only', () => {
    expect(app).toContain('Application.ActivityLifecycleCallbacks');
    expect(app).toContain('onActivityResumed');
    expect(app).toContain('onActivityPaused');
    expect(app).toContain('while (isActive && resumedActivities > 0)');
    expect(app).toContain('RECONCILE_INTERVAL_MS = 30_000L');
    expect(app).not.toContain('BOOT_COMPLETED');
    expect(manifest).not.toContain('RECEIVE_BOOT_COMPLETED');
  });

  it('uses one foreground TrackingService for both runtime modes', () => {
    expect(app).toContain('hasForegroundLocationPermission()');
    expect(app).toContain('ContextCompat.startForegroundService');
    expect(app).toContain('TrackingService::class.java');
    expect(manifest).toContain('android:name=".XDriveDriverApp"');
    expect(manifest).toContain('android:name=".TrackingService"');
    expect(manifest).toContain('android:foregroundServiceType="location"');
    expect(manifest).not.toContain('AvailabilityTrackingService');
  });

  it('keeps active-job publish cadence at the agreed 60 seconds', () => {
    expect(service).toContain('JOB_PUBLISH_INTERVAL_MS = 60_000L');
    expect(service).toContain('RuntimeMode.JOB');
    expect(service).toContain('allowStop = false');
  });

  it('requires precise/FINE location for active jobs but allows foreground coarse/fine for availability', () => {
    expect(service).toContain('hasFineLocationPermission()');
    expect(service).toContain('Manifest.permission.ACCESS_FINE_LOCATION');
    expect(service).toContain('Active delivery tracking requires Precise/Fine location.');
    expect(service).toContain('runAvailabilityMode(session)');
    expect(service).toContain('hasLocationPermission()');
  });

  it('fails closed when Android Location Services are off and remains API 26 compatible', () => {
    expect(service).toContain('LocationManager::class.java');
    expect(service).toContain('LocationManagerCompat.isLocationEnabled');
    expect(departure).toContain('LocationManagerCompat.isLocationEnabled');
    expect(service).not.toContain('LocationManager::class.java).isLocationEnabled');
    expect(departure).not.toContain('LocationManager::class.java).isLocationEnabled');
    expect(service).toContain('Settings.ACTION_LOCATION_SOURCE_SETTINGS');
    expect(service).toContain('Android Location Services are OFF');
  });

  it('keeps the running service able to switch from availability to job without a background FGS start', () => {
    expect(service).toContain('if (trackingState.shouldTrack)');
    expect(service).toContain('runJobMode(session)');
    expect(service).toContain('runAvailabilityMode(session)');
    expect(service).toContain('RECONCILE_INTERVAL_MS = 30_000L');
  });

  it('uses only the authenticated XDrive tracking-state endpoint', () => {
    expect(api).toContain('/api/driver/tracking-state');
    expect(api).toContain('Bearer $accessToken');
    expect(api).not.toContain('SUPABASE');
    expect(api).not.toContain('driver_locations');
  });
});
