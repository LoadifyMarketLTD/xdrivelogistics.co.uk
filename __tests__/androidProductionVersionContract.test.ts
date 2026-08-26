import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');

describe('Android production version contract', () => {
  it('uses a production-native versionCode above every historical repo value', () => {
    const gradle = fs.readFileSync(path.join(root, 'android-native/app/build.gradle.kts'), 'utf8');
    const match = gradle.match(/versionCode\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    const versionCode = Number(match?.[1]);
    expect(versionCode).toBe(20260826);
    expect(versionCode).toBeGreaterThan(2);
  });

  it('keeps the production package attached to that native version', () => {
    const gradle = fs.readFileSync(path.join(root, 'android-native/app/build.gradle.kts'), 'utf8');
    expect(gradle).toContain('applicationId = "co.uk.xdrivelogistics.driver"');
    expect(gradle).toContain('versionName = "1.0.0"');
  });
});
