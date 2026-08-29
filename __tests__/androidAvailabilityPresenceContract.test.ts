import fs from 'node:fs';
import path from 'node:path';

describe('Android availability presence contract', () => {
  const root = process.cwd();
  const source = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/data/AvailabilityPresenceApi.kt'),
    'utf8',
  );
  const controller = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/AvailabilityPresenceController.kt'),
    'utf8',
  );
  const panel = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/AvailabilityPresencePanel.kt'),
    'utf8',
  );
  const runtime = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/TrackingService.kt'),
    'utf8',
  );
  const mainActivity = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/MainActivity.kt'),
    'utf8',
  );
  const serverRoute = fs.readFileSync(
    path.join(root, 'app/api/driver/availability-presence/route.ts'),
    'utf8',
  );

  it('uses the dedicated server availability endpoint and never writes job GPS from the availability API', () => {
    expect(source).toContain('/api/driver/availability-presence');
    expect(source).not.toContain('/api/driver/location');
    expect(source).not.toContain('driver_locations');
  });

  it('keeps availability opt-in and bounded to approved durations', () => {
    expect(source).toContain('hours in setOf(1, 4, 8)');
    expect(source).toContain('visibility in setOf("private", "fleet", "exchange")');
    expect(source).toContain('suspend fun start(');
    expect(source).toContain('suspend fun stop(');
    expect(panel).toContain('listOf(1, 4, 8)');
    expect(panel).toContain('AvailabilityChoice("Private"');
    expect(panel).toContain('AvailabilityChoice("My Fleet"');
    expect(panel).toContain('AvailabilityChoice("Exchange"');
  });

  it('uses authenticated XDrive server calls rather than direct Supabase table writes', () => {
    expect(source).toContain('Authorization');
    expect(source).toContain('Bearer $accessToken');
    expect(source).not.toContain('SUPABASE');
    expect(source).not.toContain('supabase');
  });

  it('matches the server availability response envelopes', () => {
    expect(serverRoute).toContain('NextResponse.json({ active, presence: active ? data : null })');
    expect(serverRoute).toContain('NextResponse.json({ ok: true, visibility, available_until: availableUntil })');
    expect(serverRoute).toContain('NextResponse.json({ ok: true, available_until: presence.available_until })');
    expect(serverRoute).toContain('NextResponse.json({ ok: true })');
    expect(source).toContain('payload.objectOrNull("presence")');
    expect(source).toContain('AvailabilityPresence(true,');
    expect(source).toContain('if (!payload.bool("ok"))');
  });

  it('publishes a fresh initial availability fix, then starts the unified runtime', () => {
    expect(controller).toContain('getFusedLocationProviderClient');
    expect(controller).toContain('getCurrentLocation(');
    expect(controller).toContain('Priority.PRIORITY_BALANCED_POWER_ACCURACY');
    expect(controller).toContain('hasLocationPermission');
    expect(controller).not.toContain('lastLocation');
    expect(controller).not.toContain('startForegroundService');
    expect(panel).toContain('Intent(context, TrackingService::class.java)');
    expect(runtime).toContain('RuntimeMode.AVAILABILITY');
    expect(runtime).toContain('availabilityApi.refreshLocation(');
  });

  it('keeps the existing More/Profile integration and job tracking entrypoint', () => {
    expect(mainActivity).toContain('item { AvailabilityPresencePanel(state.session) }');
    expect(mainActivity).toContain('Intent(this, TrackingService::class.java)');
    expect(mainActivity).toContain('Text("Tracking"');
  });
});
