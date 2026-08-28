import fs from 'node:fs';
import path from 'node:path';

describe('Driver mobile job intent ownership contract', () => {
  const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
  const appConfig = read('apps/driver-mobile/app.json');
  const rootApp = read('apps/driver-mobile/App.tsx');
  const parser = read('apps/driver-mobile/src/navigation/jobIntent.ts');
  const intentScreen = read('apps/driver-mobile/src/navigation/DriverJobIntentScreen.tsx');
  const jobRoute = read('app/api/driver/mobile/jobs/[id]/route.ts');
  const notificationWorker = read('supabase/functions/notify-operational-event/index.ts');

  it('registers and parses the same canonical scheme emitted by push', () => {
    expect(appConfig).toContain('"scheme": "xdrive"');
    expect(notificationWorker).toContain('`xdrive://job/${jobId}`');
    expect(parser).toContain("protocol === 'xdrive:'");
    expect(parser).toContain("host === 'job'");
  });

  it('keeps cold-start and runtime notification response listeners wired', () => {
    expect(rootApp).toContain('Notifications.getLastNotificationResponseAsync()');
    expect(rootApp).toContain('Notifications.addNotificationResponseReceivedListener');
    expect(rootApp).toContain("Linking.addEventListener('url'");
    expect(rootApp).toContain('jobIdFromNotificationData(data)');
  });

  it('rejects arbitrary custom URL schemes', () => {
    expect(parser).toContain("if (protocol === 'https:' || protocol === 'http:')");
    expect(parser).toContain('return null;');
  });

  it('uses the current Supabase session instead of the secure-token mirror', () => {
    expect(intentScreen).toContain('supabase.auth.getSession()');
    expect(intentScreen).toContain('supabase.auth.onAuthStateChange');
    expect(intentScreen).not.toContain('getSessionToken');
    expect(intentScreen).toContain('setJob(null)');
  });

  it('keeps final authorization assignment-gated on the server', () => {
    expect(jobRoute).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(jobRoute).toContain("return respond(404, { error: 'Job not found.' })");
  });
});
