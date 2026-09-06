import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Driver phone GOLDEN side-by-side Preview runtime contract', () => {
  const v2 = read('apps/xdrive-driver-phone-golden/src/app/DriverMobileAppV2.tsx');
  const tracking = read('apps/xdrive-driver-phone-golden/src/tracking/nativeLocation.ts');
  const deepLinks = read('apps/xdrive-driver-phone-golden/src/push/driverDeepLinks.ts');
  const gradle = read('apps/xdrive-driver-phone-golden/android/app/build.gradle');
  const manifest = read('apps/xdrive-driver-phone-golden/android/app/src/main/AndroidManifest.xml');
  const mainApplication = read('apps/xdrive-driver-phone-golden/android/app/src/main/java/co/uk/xdrivelogistics/driver/MainApplication.kt');

  it('keeps already-quoted loads visible while blocking duplicate quote submission', () => {
    expect(v2).toContain('setLiveLoads(result.jobs);');
    expect(v2).not.toContain('fetchActiveQuotedJobIds');
    expect(v2).toContain('if (!editingQuoteId && load.canQuote === false)');
    expect(v2).toContain('Quote already submitted');
  });

  it('removes the login card negative overlap without changing the fixed shell contract', () => {
    expect(v2).toContain('loginCard: { marginHorizontal: 18, marginTop: 16');
    expect(v2).not.toContain('marginTop: -22');
    expect(v2).toContain('{fixedTop}');
    expect(v2).toContain('<BottomNav active={activeTab}');
  });

  it('publishes only server-confirmed active-booking location through the device-bound API contract', () => {
    expect(v2).toContain('publishCurrentDriverLocation(token)');
    expect(v2).toContain('setInterval(() => void publish(), 30_000)');
    expect(tracking).toContain("apiRequest<{ jobs?: Array<{ id?: string }> }>('/api/driver/mobile/jobs?scope=active', { token })");
    expect(tracking).toContain('No active booking requires tracking.');
    expect(tracking).toContain("NativeModules.XDriveLocation");
    expect(tracking).toContain("apiRequest('/api/driver/location'");
    expect(mainApplication).toContain('packages.add(XDriveLocationPackage())');
  });

  it('handles notification responses and only accepts XDrive deep-link targets', () => {
    expect(v2).toContain('Notifications.addNotificationResponseReceivedListener');
    expect(v2).toContain('Notifications.getLastNotificationResponseAsync()');
    expect(v2).toContain('Linking.addEventListener');
    expect(deepLinks).toContain("['xdrivedriver', 'xdrivedriver-preview', 'xdrive']");
    expect(deepLinks).toContain("url.hostname.endsWith('.xdrivelogistics.co.uk')");
  });

  it('makes Preview package and custom scheme fail closed for both debug and release builds', () => {
    expect(gradle).toContain("sideBySidePreview ? 'co.uk.xdrivelogistics.driver.preview' : 'co.uk.xdrivelogistics.driver'");
    expect(gradle).toContain("sideBySidePreview ? 'xdrivedriver-preview' : 'xdrivedriver'");
    expect(manifest).toContain('android:scheme="${xdriveDriverScheme}"');
  });
});
