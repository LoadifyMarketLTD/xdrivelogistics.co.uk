import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('Android Firebase production contract', () => {
  it('requires all Firebase Android values for release tasks', () => {
    const gradle = read('android-native/app/build.gradle.kts');
    for (const key of [
      'XDRIVE_FIREBASE_PROJECT_ID',
      'XDRIVE_FIREBASE_APPLICATION_ID',
      'XDRIVE_FIREBASE_API_KEY',
      'XDRIVE_FIREBASE_SENDER_ID',
    ]) {
      expect(gradle).toContain(key);
    }
    expect(gradle).toContain('firebaseClientConfigComplete');
    expect(gradle).toContain('releaseTaskRequested && !firebaseClientConfigComplete');
  });

  it('keeps Firebase service-account material server-only', () => {
    const gradle = read('android-native/app/build.gradle.kts');
    const server = read('supabase/functions/notify-operational-event/index.ts');
    expect(gradle).not.toContain('FIREBASE_SERVICE_ACCOUNT_JSON');
    expect(server).toContain("Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')");
  });

  it('keeps assigned-job deep-link intent parity in reviewed server source', () => {
    const fcm = read('supabase/functions/notify-operational-event/fcm.ts');
    const manifest = read('android-native/app/src/main/AndroidManifest.xml');
    expect(fcm).toContain("click_action: 'co.uk.xdrivelogistics.driver.OPEN_JOB'");
    expect(manifest).toContain('android:name="co.uk.xdrivelogistics.driver.OPEN_JOB"');
  });

  it('does not claim physical FCM delivery before a registered device exists', () => {
    const doc = read('android-native/FIREBASE_PRODUCTION.md');
    expect(doc).toContain('0 registered devices');
    expect(doc).toContain('Do not mark production push PASS');
  });
});
