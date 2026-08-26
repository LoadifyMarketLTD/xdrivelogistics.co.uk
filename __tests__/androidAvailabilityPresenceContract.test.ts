import fs from 'node:fs';
import path from 'node:path';

describe('Android availability presence contract', () => {
  const root = process.cwd();
  const source = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/data/AvailabilityPresenceApi.kt'),
    'utf8',
  );

  it('uses the dedicated server availability endpoint only', () => {
    expect(source).toContain('/api/driver/availability-presence');
    expect(source).not.toContain('/api/driver/location');
    expect(source).not.toContain('driver_locations');
    expect(source).not.toContain('TrackingService');
  });

  it('keeps availability opt-in and bounded to approved durations', () => {
    expect(source).toContain('hours in setOf(1, 4, 8)');
    expect(source).toContain('visibility in setOf("private", "fleet", "exchange")');
    expect(source).toContain('suspend fun start(');
    expect(source).toContain('suspend fun stop(');
  });

  it('uses authenticated XDrive server calls rather than direct Supabase table writes', () => {
    expect(source).toContain('Authorization');
    expect(source).toContain('Bearer $accessToken');
    expect(source).not.toContain('SUPABASE');
    expect(source).not.toContain('supabase');
  });
});
