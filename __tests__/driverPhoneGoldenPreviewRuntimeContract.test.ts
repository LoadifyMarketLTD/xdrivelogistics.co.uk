import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Driver phone GOLDEN side-by-side Preview runtime contract', () => {
  const app = read('apps/xdrive-driver-phone-golden/App.tsx');
  const v3 = read('apps/xdrive-driver-phone-golden/src/app/DriverMobileAppV3.tsx');
  const tracking = read('apps/xdrive-driver-phone-golden/src/tracking/nativeLocation.ts');
  const deepLinks = read('apps/xdrive-driver-phone-golden/src/push/driverDeepLinks.ts');
  const gradle = read('apps/xdrive-driver-phone-golden/android/app/build.gradle');
  const manifest = read('apps/xdrive-driver-phone-golden/android/app/src/main/AndroidManifest.xml');
  const mainApplication = read('apps/xdrive-driver-phone-golden/android/app/src/main/java/co/uk/xdrivelogistics/driver/MainApplication.kt');

  it('uses the independently differentiated V3 runtime for side-by-side Preview', () => {
    expect(app).toContain("await import('./src/app/DriverMobileAppV3')");
    expect(v3).toContain("type PrimaryTab = 'overview' | 'loads' | 'offers' | 'history' | 'account'");
    expect(v3).toContain("['overview', 'Overview', 'XD']");
    expect(v3).toContain("['loads', 'Loads', '↗']");
    expect(v3).toContain("['offers', 'Offers', '£']");
    expect(v3).toContain("['history', 'History', '≡']");
    expect(v3).toContain("['account', 'Account', 'ID']");
    expect(v3).not.toContain("['home', 'Home'");
    expect(v3).not.toContain("['alerts', 'Alerts'");
    expect(v3).not.toContain("['quotes', 'Quotes'");
    expect(v3).not.toContain("['bookings', 'Bookings'");
    expect(v3).not.toContain("['more', 'More'");
  });

  it('uses XDrive-specific information architecture instead of CX-style labels and buckets', () => {
    expect(v3).toContain('title="Load Board"');
    expect(v3).toContain("[['available', 'Available'], ['starred', 'Starred'], ['dismissed', 'Dismissed']]");
    expect(v3).toContain('title="Offers"');
    expect(v3).toContain("[['active', 'Active'], ['won', 'Won'], ['archived', 'Archived']]");
    expect(v3).toContain('title="History"');
    expect(v3).not.toContain('Past 7 days');
    expect(v3).not.toContain('Past 14');
    expect(v3).not.toContain("label=\"Search\"");
    expect(v3).not.toContain("label=\"Network\"");
    expect(v3).not.toContain("label=\"Journeys\"");
    expect(v3).not.toContain("['summary', 'Summary']");
    expect(v3).not.toContain("['stops', 'Stops']");
    expect(v3).not.toContain("['status', 'Status']");
  });

  it('keeps already-offered loads visible while blocking duplicate offer submission', () => {
    expect(v3).toContain('setLiveLoads(result.jobs);');
    expect(v3).toContain('if (!editingOfferId && load.canQuote === false)');
    expect(v3).toContain('Offer already sent');
  });

  it('removes the login card negative overlap and preserves the fixed-shell contract', () => {
    expect(v3).toContain('loginCard: { marginHorizontal: 18, marginTop: 16');
    expect(v3).not.toContain('marginTop: -22');
    expect(v3).toContain('{fixedTop}');
    expect(v3).toContain('<BottomDock active={activeTab}');
  });

  it('publishes only server-confirmed active-booking location through the device-bound API contract', () => {
    expect(v3).toContain('publishCurrentDriverLocation(token)');
    expect(v3).toContain('setInterval(() => void publish(), 30_000)');
    expect(tracking).toContain("apiRequest<{ jobs?: Array<{ id?: string }> }>('/api/driver/mobile/jobs?scope=active', { token })");
    expect(tracking).toContain('No active booking requires tracking.');
    expect(tracking).toContain('NativeModules.XDriveLocation');
    expect(tracking).toContain("apiRequest('/api/driver/location'");
    expect(mainApplication).toContain('packages.add(XDriveLocationPackage())');
  });

  it('handles notification responses and only accepts XDrive deep-link targets', () => {
    expect(v3).toContain('Notifications.addNotificationResponseReceivedListener');
    expect(v3).toContain('Notifications.getLastNotificationResponseAsync()');
    expect(v3).toContain('Linking.addEventListener');
    expect(deepLinks).toContain("['xdrivedriver', 'xdrivedriver-preview', 'xdrive']");
    expect(deepLinks).toContain("url.hostname.endsWith('.xdrivelogistics.co.uk')");
  });

  it('makes Preview package and custom scheme fail closed for both debug and release builds', () => {
    expect(gradle).toContain("sideBySidePreview ? 'co.uk.xdrivelogistics.driver.preview' : 'co.uk.xdrivelogistics.driver'");
    expect(gradle).toContain("sideBySidePreview ? 'xdrivedriver-preview' : 'xdrivedriver'");
    expect(manifest).toContain('android:scheme="${xdriveDriverScheme}"');
  });
});
