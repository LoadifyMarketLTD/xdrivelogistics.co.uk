import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');

describe('Android production signing contract', () => {
  it('requires explicit production keystore material for release tasks', () => {
    const gradle = fs.readFileSync(path.join(root, 'android-native/app/build.gradle.kts'), 'utf8');
    for (const key of [
      'XDRIVE_ANDROID_KEYSTORE_PATH',
      'XDRIVE_ANDROID_STORE_PASSWORD',
      'XDRIVE_ANDROID_KEY_ALIAS',
      'XDRIVE_ANDROID_KEY_PASSWORD',
    ]) {
      expect(gradle).toContain(key);
    }
    expect(gradle).toContain('releaseTaskRequested && !releaseSigningComplete');
    expect(gradle).toContain('GradleException');
  });

  it('does not configure release with the debug signing key', () => {
    const gradle = fs.readFileSync(path.join(root, 'android-native/app/build.gradle.kts'), 'utf8');
    expect(gradle).not.toContain('signingConfigs.getByName("debug")');
    expect(gradle).not.toContain('signingConfig = signingConfigs.debug');
  });

  it('documents Play lineage verification before a production bundle', () => {
    const doc = fs.readFileSync(path.join(root, 'android-native/PRODUCTION_SIGNING.md'), 'utf8');
    expect(doc).toContain('Upload certificate SHA-256 fingerprint');
    expect(doc).toContain('Request upload key reset');
    expect(doc).toContain('Do not commit private keys');
  });
});
