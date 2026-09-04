import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

const MAIN_ACTIVITY =
  'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/MainActivity.kt';
const PARITY_HELPERS =
  'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/NativeUsefulParity.kt';
const MODELS =
  'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/data/Models.kt';
const ANDROID_ROOT_BUILD = 'android-native/build.gradle.kts';
const ANDROID_APP_BUILD = 'android-native/app/build.gradle.kts';

describe('PR #497 Android native useful-parity contract', () => {
  it('uses backend-authoritative unread state in persistent native navigation', () => {
    const main = readRepoFile(MAIN_ACTIVITY);
    const helpers = readRepoFile(PARITY_HELPERS);

    expect(helpers).toContain('notifications.count { it.readAt.isNullOrBlank() }');
    expect(main).toContain('unreadCount = unreadUpdatesCount(state.notifications)');
    expect(main).toContain('tab.navLabel(activeCount, unreadCount)');
    expect(main).toContain('DriverTab.MESSAGES -> unreadUpdatesLabel(unreadCount)');
  });

  it('renders nearby-driver presence without exposing coordinates', () => {
    const main = readRepoFile(MAIN_ACTIVITY);
    const helpers = readRepoFile(PARITY_HELPERS);

    expect(main).toContain('nearbyDriverDisplayRows(state.nearbyDrivers)');
    expect(main).toContain('driver.driverName');
    expect(main).toContain('driver.vehicleLabel');
    expect(main).toContain('driver.lastSeenLabel');
    expect(main).toContain('exact driver coordinates are never shown');
    expect(helpers).not.toContain('driver.lat');
    expect(helpers).not.toContain('driver.lng');
  });

  it('keeps the canonical delivery lifecycle including in_transit', () => {
    const main = readRepoFile(MAIN_ACTIVITY);
    const models = readRepoFile(MODELS);

    expect(main).toMatch(/"loaded",\s*\n\s*"in_transit",\s*\n\s*"on_site_delivery"/);
    expect(main).toContain('"in_transit" -> "On My Way to Delivery"');
    expect(models).toContain('"loaded" -> "in_transit"');
    expect(models).toContain('"in_transit" -> "on_site_delivery"');
    expect(models).toContain('"in_transit" -> "On My Way to Delivery"');
  });

  it('does not shadow canonical DriverJob lifecycle members in MainActivity', () => {
    const main = readRepoFile(MAIN_ACTIVITY);
    const staleExtensions = [
      'private fun DriverJob.statusKey()',
      'private fun DriverJob.driverStatusKey()',
      'private fun DriverJob.isInProgress()',
      'private fun DriverJob.isActive()',
      'private fun DriverJob.hasPod()',
      'private fun DriverJob.isPosted()',
      'private fun DriverJob.routeLabel()',
      'private fun DriverJob.statusLabel()',
      'private fun DriverJob.nextStatus()',
      'private fun DriverJob.nextActionLabel()',
      'private fun DriverJob.canMoveNext()',
    ];

    for (const extension of staleExtensions) {
      expect(main).not.toContain(extension);
    }
  });

  it('uses an API 35-compatible Android and Kotlin toolchain while keeping JDK 17 bytecode', () => {
    const rootBuild = readRepoFile(ANDROID_ROOT_BUILD);
    const appBuild = readRepoFile(ANDROID_APP_BUILD);

    expect(rootBuild).toContain('id("com.android.application") version "8.6.1"');
    expect(rootBuild).toContain('id("org.jetbrains.kotlin.android") version "2.1.20"');
    expect(rootBuild).toContain('id("org.jetbrains.kotlin.plugin.compose") version "2.1.20"');
    expect(appBuild).toContain('id("org.jetbrains.kotlin.plugin.compose")');
    expect(appBuild).not.toContain('kotlinCompilerExtensionVersion');
    expect(appBuild).toContain('compileSdk = 35');
    expect(appBuild).toContain('targetSdk = 35');
    expect(appBuild).toContain('JavaVersion.VERSION_17');
    expect(appBuild).toContain('jvmTarget = "17"');
  });
});
