import fs from 'node:fs';
import path from 'node:path';

describe('Android periodic availability contract', () => {
  const root = process.cwd();
  const service = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/AvailabilityTrackingService.kt'),
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

  it('uses a dedicated pre-award foreground service at a five-minute interval', () => {
    expect(service).toContain('class AvailabilityTrackingService : Service()');
    expect(service).toContain('REFRESH_INTERVAL_MS = 5 * 60_000L');
    expect(manifest).toContain('android:name=".AvailabilityTrackingService"');
    expect(manifest).toContain('android:foregroundServiceType="location"');
    expect(panel).toContain('AvailabilityTrackingService::class.java');
  });

  it('never invokes active-job TrackingService or driver_locations', () => {
    expect(service).not.toContain('Intent(this, TrackingService::class.java)');
    expect(service).not.toContain('driver_locations');
    expect(api).not.toContain('driver_locations');
    expect(server).not.toContain(".from('driver_locations')");
  });

  it('refreshes coordinates without extending the explicit auto-off window', () => {
    expect(api).toContain('method = "PUT"');
    expect(api).toContain('suspend fun refreshLocation(');
    expect(server).toContain('export async function PUT(request: NextRequest)');
    expect(server).toContain(".select('available_until')");
    expect(server).toContain('available_until: presence.available_until');
    expect(server).not.toContain('export async function PUT(request: NextRequest) {\n  const now = new Date();');
  });

  it('fails closed when availability expires, driver becomes unavailable, or a job starts', () => {
    expect(server).toContain('ensureAvailabilityEligible');
    expect(server).toContain('Availability sharing is disabled while you have an active assigned job.');
    expect(server).toContain('Availability sharing is no longer active.');
    expect(service).toContain('error.isAvailabilityEnded()');
    expect(service).toContain('stopSelf()');
  });

  it('stops server presence as well as the local service from the notification action', () => {
    expect(service).toContain('ACTION_STOP');
    expect(service).toContain('availabilityApi.stop(session)');
    expect(service).toContain('"Stop availability"');
  });

  it('keeps periodic availability free of routing/traffic providers', () => {
    expect(service).not.toContain('MAPBOX');
    expect(service).not.toContain('mapbox.com');
    expect(server).not.toContain('MAPBOX');
    expect(server).not.toContain('mapbox.com');
  });
});
