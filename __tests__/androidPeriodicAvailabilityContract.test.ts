import fs from 'node:fs';
import path from 'node:path';

describe('Android unified location runtime contract', () => {
  const root = process.cwd();
  const service = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/TrackingService.kt'),
    'utf8',
  );
  const panel = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/AvailabilityPresencePanel.kt'),
    'utf8',
  );
  const api = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/data/AvailabilityPresenceApi.kt'),
    'utf8',
  );
  const server = fs.readFileSync(
    path.join(root, 'app/api/driver/availability-presence/route.ts'),
    'utf8',
  );
  const manifest = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/AndroidManifest.xml'),
    'utf8',
  );

  it('uses one foreground location service with separate JOB and AVAILABILITY modes', () => {
    expect(service).toContain('enum class RuntimeMode { CHECKING, JOB, AVAILABILITY }');
    expect(service).toContain('JOB_PUBLISH_INTERVAL_MS = 60_000L');
    expect(service).toContain('AVAILABILITY_PUBLISH_INTERVAL_MS = 5 * 60_000L');
    expect(service).toContain('RECONCILE_INTERVAL_MS = 30_000L');
    expect(manifest).toContain('android:name=".TrackingService"');
    expect(manifest).not.toContain('AvailabilityTrackingService');
    expect(panel).toContain('Intent(context, TrackingService::class.java)');
  });

  it('switches internally to job mode instead of starting a second location foreground service', () => {
    expect(service).toContain('if (trackingState.shouldTrack)');
    expect(service).toContain('runJobMode(session)');
    expect(service).toContain('runAvailabilityMode(session)');
    expect(service).not.toContain('AvailabilityTrackingService');
    expect(panel).not.toContain('AvailabilityTrackingService');
  });

  it('keeps availability storage/API separate from active-job driver locations', () => {
    expect(api).toContain('/api/driver/availability-presence');
    expect(api).not.toContain('/api/driver/location');
    expect(api).not.toContain('driver_locations');
    expect(server).not.toContain(".from('driver_locations')");
    expect(service).toContain('availabilityApi.refreshLocation(');
    expect(service).toContain('api.sendLocation(');
  });

  it('refreshes availability coordinates without extending the explicit auto-off window', () => {
    expect(api).toContain('requestJson("/api/driver/availability-presence", session.accessToken, "PUT", body)');
    expect(api).toContain('suspend fun refreshLocation(');
    expect(server).toContain('export async function PUT(request: NextRequest)');
    expect(server).toContain(".select('available_until')");
    expect(server).toContain('available_until: presence.available_until');
  });

  it('does not let availability controls disable mandatory active-job tracking', () => {
    expect(service).toContain('ACTION_STOP_AVAILABILITY');
    expect(service).toContain('if (state?.shouldTrack == true)');
    expect(service).toContain('Availability controls cannot stop tracking for an active allocated job.');
    expect(service).toContain('allowStop = false');
  });

  it('keeps periodic location runtime free of routing/traffic providers', () => {
    expect(service).not.toContain('MAPBOX');
    expect(service).not.toContain('mapbox.com');
    expect(server).not.toContain('MAPBOX');
    expect(server).not.toContain('mapbox.com');
  });
});
