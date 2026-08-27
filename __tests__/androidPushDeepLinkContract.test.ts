import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Android push job deep-link contract', () => {
  const root = process.cwd();
  const manifest = fs.readFileSync(path.join(root, 'android-native/app/src/main/AndroidManifest.xml'), 'utf8');
  const activity = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/JobDeepLinkActivity.kt'),
    'utf8',
  );
  const parser = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/JobDeepLinkParser.kt'),
    'utf8',
  );
  const store = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/PendingJobDeepLinkStore.kt'),
    'utf8',
  );
  const viewModel = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/DriverViewModel.kt'),
    'utf8',
  );
  const messaging = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/XDriveMessagingService.kt'),
    'utf8',
  );
  const fcm = fs.readFileSync(path.join(root, 'supabase/functions/notify-operational-event/fcm.ts'), 'utf8');

  it('routes custom, verified https and FCM click actions through a dedicated job router', () => {
    expect(manifest).toContain('android:name=".JobDeepLinkActivity"');
    expect(manifest).toContain('co.uk.xdrivelogistics.driver.OPEN_JOB');
    expect(manifest).toContain('android:scheme="xdrive" android:host="job"');
    expect(manifest).toContain('android:pathPrefix="/driver/jobs/"');
    expect(fcm).toContain("click_action: 'co.uk.xdrivelogistics.driver.OPEN_JOB'");
    expect(messaging).toContain('JobDeepLinkActivity::class.java');
  });

  it('supports foreground, background and cold-start payload shapes', () => {
    expect(activity).toContain('getStringExtra(EXTRA_JOB_ID)');
    expect(activity).toContain('dataString');
    expect(activity).toContain('getStringExtra(EXTRA_DEEP_LINK)');
    expect(parser).toContain('scheme == "xdrive" && host == "job"');
    expect(parser).toContain('host == "www.xdrivelogistics.co.uk"');
  });

  it('persists a short-lived pending job until authorized jobs are loaded', () => {
    expect(store).toContain('MAX_AGE_MS = 15 * 60_000L');
    expect(viewModel).toContain('pendingJobDeepLinkStore.pendingJobIds.collectLatest');
    expect(viewModel).toContain('_uiState.value.jobs.none { it.id == jobId }');
    expect(viewModel).toContain('applyPendingJobDeepLinkIfReady()');
    expect(viewModel).toContain('pendingJobDeepLinkStore.clear()');
  });

  it('does not navigate to an unverified or unauthorized job id', () => {
    const membershipCheck = viewModel.indexOf('_uiState.value.jobs.none { it.id == jobId }');
    const actionSwitch = viewModel.indexOf('selectedTab = DriverTab.ACTION', membershipCheck);
    expect(membershipCheck).toBeGreaterThan(-1);
    expect(actionSwitch).toBeGreaterThan(membershipCheck);
    expect(parser).toContain("value.any { it.isWhitespace() || it == '/' || it == '?' || it == '#' }");
  });
});
