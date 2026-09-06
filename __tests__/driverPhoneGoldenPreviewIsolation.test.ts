import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('phone GOLDEN preview isolation', () => {
  const appSource = fs.readFileSync(
    path.join(process.cwd(), 'apps/xdrive-driver-phone-golden/App.tsx'),
    'utf8',
  );
  const configSource = fs.readFileSync(
    path.join(process.cwd(), 'apps/xdrive-driver-phone-golden/app.config.ts'),
    'utf8',
  );

  it('loads the approved V3 workspace only for the side-by-side preview profile', () => {
    expect(appSource).toContain("Constants.expoConfig?.extra?.sideBySidePreview === true");
    expect(appSource).toContain("await import('./src/app/DriverMobileAppV3')");
    expect(appSource).not.toContain("await import('./src/app/DriverMobileAppV2')");
    expect(appSource).toContain("await import('./src/app/DriverMobileApp')");
  });

  it('keeps the preview package physically separate from the GOLDEN package', () => {
    expect(configSource).toContain("'co.uk.xdrivelogistics.driver.preview'");
    expect(configSource).toContain("'co.uk.xdrivelogistics.driver'");
    expect(configSource).toContain("sideBySidePreview: isSideBySidePreview");
  });

  it('forces the rebuilt preview into the approved light-first appearance only', () => {
    expect(configSource).toContain("userInterfaceStyle: isSideBySidePreview ? 'light' : 'automatic'");
  });
});
