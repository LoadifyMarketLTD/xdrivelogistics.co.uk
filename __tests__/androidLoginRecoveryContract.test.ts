import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

describe('Android native login and recovery contract', () => {
  it('uses LoginActivity as launcher and routes recovery deep links there', () => {
    const manifest = read('android-native/app/src/main/AndroidManifest.xml');
    expect(manifest).toContain('android:name=".LoginActivity"');
    expect(manifest).toContain('android:name="android.intent.category.LAUNCHER"');
    expect(manifest).toContain('android:scheme="xdrive" android:host="reset-password"');
  });

  it('keeps biometric login permanently absent from the native login implementation', () => {
    const login = read('android-native/app/src/main/java/co/uk/xdrivelogistics/driver/LoginActivity.kt');
    const gradle = read('android-native/app/build.gradle.kts');
    expect(login.toLowerCase()).not.toContain('biometric');
    expect(gradle).not.toContain('androidx.biometric');
  });

  it('never stores the password for keep-signed-in', () => {
    const preferences = read('android-native/app/src/main/java/co/uk/xdrivelogistics/driver/data/LoginPreferenceStore.kt');
    const sessionStore = read('android-native/app/src/main/java/co/uk/xdrivelogistics/driver/data/SessionStore.kt');
    expect(preferences).toContain('remember_me');
    expect(preferences.toLowerCase()).not.toContain('password');
    expect(sessionStore).toContain('EncryptedSharedPreferences');
    expect(sessionStore).toContain('!loginPreferences.rememberMe');
  });

  it('uses Supabase recovery and only accepts the dedicated recovery deep link', () => {
    const recovery = read('android-native/app/src/main/java/co/uk/xdrivelogistics/driver/data/PasswordRecoveryApi.kt');
    expect(recovery).toContain('/auth/v1/recover?redirect_to=');
    expect(recovery).toContain('/auth/v1/user');
    expect(recovery).toContain('const val REDIRECT_URI = "xdrive://reset-password"');
    expect(recovery).toContain('it["type"] == "recovery"');
    expect(recovery).toContain('?.get("access_token")');
  });

  it('gates job deep links through login when no encrypted session exists', () => {
    const activity = read('android-native/app/src/main/java/co/uk/xdrivelogistics/driver/JobDeepLinkActivity.kt');
    expect(activity).toContain('SessionStore(applicationContext).readSession() == null');
    expect(activity).toContain('LoginActivity::class.java');
    expect(activity).toContain('PendingJobDeepLinkStore(applicationContext).save(jobId)');
  });
});
