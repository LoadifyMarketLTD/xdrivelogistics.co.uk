import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('Android production ownership contract', () => {
  it('assigns the production application id to the Expo driver app', () => {
    const appJson = JSON.parse(read('apps/driver-mobile/app.json'));
    const appConfig = read('apps/driver-mobile/app.config.ts');
    expect(appJson.expo.android.package).toBe('co.uk.xdrivelogistics.driver');
    expect(appJson.expo.ios.bundleIdentifier).toBe('co.uk.xdrivelogistics.driver');
    expect(appConfig).toContain("package: 'co.uk.xdrivelogistics.driver'");
    expect(appConfig).toContain("bundleIdentifier: 'co.uk.xdrivelogistics.driver'");
  });

  it('marks apps/driver-mobile as the production candidate owner', () => {
    const appJson = JSON.parse(read('apps/driver-mobile/app.json'));
    const appConfig = read('apps/driver-mobile/app.config.ts');
    expect(appJson.expo.extra.productionOwner).toBe('apps/driver-mobile');
    expect(appJson.expo.extra.releaseChannel).toBe('production-candidate');
    expect(appConfig).toContain("productionOwner: 'apps/driver-mobile'");
    expect(appConfig).toContain("releaseChannel: 'production-candidate'");
  });

  it('keeps an internal production-candidate APK profile without a store submit path', () => {
    const eas = JSON.parse(read('apps/driver-mobile/eas.json'));
    const pkg = JSON.parse(read('apps/driver-mobile/package.json'));
    expect(eas.build['production-apk'].distribution).toBe('internal');
    expect(eas.build['production-apk'].android.buildType).toBe('apk');
    expect(eas.submit).toBeUndefined();
    expect(pkg.scripts['build:android:apk']).toContain('--profile production-apk');
  });

  it('documents Expo as the canonical production candidate and blocks premature release', () => {
    const readme = read('apps/driver-mobile/README.md');
    expect(readme).toContain('canonical XDrive Driver application source');
    expect(readme).toContain('Do not publish or submit a store build');
    expect(readme).toContain('never generate a replacement production keystore');
  });
});
