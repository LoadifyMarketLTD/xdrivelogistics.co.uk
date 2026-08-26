import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('Android production ownership contract', () => {
  it('reserves the production application id for android-native', () => {
    const nativeGradle = read('android-native/app/build.gradle.kts');
    expect(nativeGradle).toContain('applicationId = "co.uk.xdrivelogistics.driver"');
  });

  it('keeps Expo on the explicit preview identity in every Expo config source', () => {
    const appJson = JSON.parse(read('apps/driver-mobile/app.json'));
    const appConfig = read('apps/driver-mobile/app.config.ts');
    expect(appJson.expo.android.package).toBe('co.uk.xdrivelogistics.driver.preview');
    expect(appJson.expo.ios.bundleIdentifier).toBe('co.uk.xdrivelogistics.driver.preview');
    expect(appJson.expo.extra.releaseChannel).toBe('preview');
    expect(appConfig).toContain("package: 'co.uk.xdrivelogistics.driver.preview'");
    expect(appConfig).toContain("bundleIdentifier: 'co.uk.xdrivelogistics.driver.preview'");
  });

  it('prevents Expo from exposing a Play Store production build or submit profile', () => {
    const eas = JSON.parse(read('apps/driver-mobile/eas.json'));
    const pkg = JSON.parse(read('apps/driver-mobile/package.json'));
    expect(eas.build.production).toBeUndefined();
    expect(eas.submit).toBeUndefined();
    expect(pkg.scripts['build:android:aab']).toBeUndefined();
    expect(pkg.scripts['build:android:apk']).toContain('--profile preview');
  });

  it('documents Kotlin as the production owner and Expo as preview only', () => {
    const readme = read('apps/driver-mobile/README.md');
    expect(readme).toContain('Production Android source: `android-native/`');
    expect(readme).toContain('Expo preview package: `co.uk.xdrivelogistics.driver.preview`');
    expect(readme).toContain('must not be submitted to the Play Store');
  });
});
