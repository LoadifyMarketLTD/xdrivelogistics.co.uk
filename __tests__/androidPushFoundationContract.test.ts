import fs from 'node:fs';
import path from 'node:path';

describe('Android native push foundation contract', () => {
  const root = process.cwd();
  const migration = fs.readFileSync(
    path.join(root, 'supabase/migrations/20260826132000_driver_push_devices.sql'),
    'utf8',
  );
  const route = fs.readFileSync(
    path.join(root, 'app/api/driver/push-devices/route.ts'),
    'utf8',
  );
  const gradle = fs.readFileSync(path.join(root, 'android-native/app/build.gradle.kts'), 'utf8');
  const manifest = fs.readFileSync(path.join(root, 'android-native/app/src/main/AndroidManifest.xml'), 'utf8');
  const app = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/XDriveDriverApp.kt'),
    'utf8',
  );
  const messaging = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/XDriveMessagingService.kt'),
    'utf8',
  );
  const manager = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/PushRegistrationManager.kt'),
    'utf8',
  );
  const sessionStore = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/data/SessionStore.kt'),
    'utf8',
  );
  const worker = fs.readFileSync(
    path.join(root, 'supabase/functions/notify-operational-event/index.ts'),
    'utf8',
  );
  const fcm = fs.readFileSync(
    path.join(root, 'supabase/functions/notify-operational-event/fcm.ts'),
    'utf8',
  );

  it('keeps provider tokens server-only and binds delivery to a live unexpired auth session', () => {
    expect(migration).toContain('create table if not exists public.driver_push_devices');
    expect(migration).toContain('auth_session_id uuid not null');
    expect(migration).toContain('alter table public.driver_push_devices enable row level security');
    expect(migration).toContain('revoke all on table public.driver_push_devices from anon, authenticated');
    expect(migration).toContain('join auth.sessions s');
    expect(migration).toContain('s.id = d.auth_session_id');
    expect(migration).toContain('(s.not_after is null or s.not_after > now())');
    expect(migration).toContain('grant execute on function public.active_driver_push_devices_for_user(uuid) to service_role');
  });

  it('registers tokens only through an authenticated active-driver server boundary', () => {
    expect(route).toContain('supabaseAdmin.auth.getUser(token)');
    expect(route).toContain(".eq('status', 'active')");
    expect(route).toContain('driver.app_access !== true');
    expect(route).toContain("appPackage !== ANDROID_PACKAGE");
    expect(route).toContain('auth_session_id: auth.sessionId');
    expect(route).not.toContain('service_role');
  });

  it('uses the supported Firebase main module without embedding Firebase credentials', () => {
    expect(gradle).toContain('com.google.firebase:firebase-bom:34.18.0');
    expect(gradle).toContain('implementation("com.google.firebase:firebase-messaging")');
    expect(gradle).not.toContain('firebase-messaging-ktx');
    expect(manager).toContain('FirebaseOptions.Builder()');
    expect(manager).toContain('if (!isConfigured()) return false');
    expect(manager).not.toContain('serviceAccount');
    expect(manager).not.toContain('private_key');
  });

  it('requests Android 13 notification permission once after authentication', () => {
    expect(manifest).toContain('android.permission.POST_NOTIFICATIONS');
    expect(app).toContain('Manifest.permission.POST_NOTIFICATIONS');
    expect(app).toContain('ActivityCompat.requestPermissions(');
    expect(app).toContain('KEY_NOTIFICATION_PERMISSION_REQUESTED');
    expect(app).toContain('sessionStore.readSession()');
    expect(app).not.toContain('ACCESS_BACKGROUND_LOCATION');
  });

  it('registers a non-exported messaging service and deep-links assigned jobs', () => {
    expect(manifest).toContain('android:name=".XDriveMessagingService"');
    expect(manifest).toContain('android:exported="false"');
    expect(manifest).toContain('com.google.firebase.MESSAGING_EVENT');
    expect(messaging).toContain('override fun onNewToken(token: String)');
    expect(messaging).toContain('override fun onMessageReceived(message: RemoteMessage)');
    expect(messaging).toContain('Uri.parse("xdrive://job/$jobId")');
  });

  it('keeps push cleanup best-effort before auth-session revocation', () => {
    const cleanup = sessionStore.indexOf('unregisterPushBestEffort(pending)');
    const revoke = sessionStore.indexOf('revoker.revoke(pending)', cleanup);
    expect(cleanup).toBeGreaterThan(-1);
    expect(revoke).toBeGreaterThan(cleanup);
    expect(sessionStore).toContain('private suspend fun unregisterPushBestEffort(session: DriverSession)');
    expect(sessionStore).toContain('pushApi.unregister(session, installationIdentity.installationId)');
    expect(sessionStore).not.toContain('pushApi.unregister(session, installationIdentity.installationId).getOrThrow()');
  });

  it('adds FCM to the canonical job_assigned queue rather than creating a parallel assignment trigger', () => {
    expect(worker).toContain("case 'job_assigned': success = await handleJobAssigned(event)");
    expect(worker).toContain("supabase.rpc('active_driver_push_devices_for_user'");
    expect(worker).toContain('sendAssignedJobPush(userId, jobIdRaw)');
    expect(worker).toContain("Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')");
    expect(fcm).toContain("npm:google-auth-library@11.0.2");
    expect(fcm).toContain('https://www.googleapis.com/auth/firebase.messaging');
    expect(fcm).toContain('UNREGISTERED');
  });

  it('does not commit or expose Firebase server credentials in Android code', () => {
    const combined = [gradle, manifest, app, messaging, manager, route].join('\n');
    expect(combined).not.toMatch(/BEGIN PRIVATE KEY/);
    expect(combined).not.toContain('FIREBASE_SERVICE_ACCOUNT_JSON');
    expect(combined).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
