import fs from 'node:fs';
import path from 'node:path';

describe('Android tracking stop contract', () => {
  const servicePath = path.join(
    process.cwd(),
    'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/TrackingService.kt',
  );
  const source = fs.readFileSync(servicePath, 'utf8');

  test('external service stops recover while the authenticated app is visible', () => {
    expect(source).toContain('val recoverFromExternalStop = !intentionalStop');
    expect(source).toContain('XDriveDriverApp.isAppVisible');
    expect(source).toContain('ContextCompat.startForegroundService(');
  });

  test('semantic ACTION_STOP refuses to stop an active assigned job', () => {
    expect(source).toContain('if (intent?.action == ACTION_STOP)');
    expect(source).toContain('scope.launch { stopIfNoActiveJob() }');
    expect(source).toMatch(/private suspend fun stopIfNoActiveJob\(\)[\s\S]*state\?\.shouldTrack == true[\s\S]*Live tracking remains active while this job is allocated to you\./);
  });

  test('availability stop remains separate from mandatory active-job tracking', () => {
    expect(source).toContain('ACTION_STOP_AVAILABILITY');
    expect(source).toMatch(/stopAvailabilityIfNoActiveJob\(\)[\s\S]*Availability controls cannot stop tracking for an active allocated job\./);
  });
});
