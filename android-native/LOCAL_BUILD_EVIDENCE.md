# XDrive Android — Local Build Evidence

This file defines what counts as evidence for Problem 14/15. GitHub Actions are not required and are not accepted as a substitute while repository runners are unavailable.

## Required command

Run from `android-native/` on a machine with JDK 17+, Android SDK and network access to Gradle/Maven dependencies:

### Windows PowerShell

```powershell
.\verify-local-build.ps1
```

### Linux/macOS

```bash
./verify-local-build.sh
```

## PASS requires all of the following

1. Gradle wrapper starts successfully.
2. `clean` succeeds.
3. `testDebugUnitTest` succeeds.
4. `assembleDebug` succeeds.
5. `app/build/outputs/apk/debug/app-debug.apk` exists.
6. APK size and SHA-256 are recorded.
7. The exact Git commit used for the build is recorded separately with `git rev-parse HEAD`.

A static review, GitHub check mark, Netlify deploy, TypeScript test, Kotlin source inspection, or partial `kotlinc` invocation is **not** an Android build PASS.

## Environment attempt from ChatGPT execution container — 2026-08-26

The isolated execution container could not perform the build because:

- `github.com` DNS resolution is unavailable, so the repository cannot be cloned there;
- Gradle is not installed and no cached Gradle wrapper distribution is present;
- Android SDK / `ANDROID_HOME` is absent;
- Java and `kotlinc` are present, but that is insufficient for an Android/Compose build.

This is an environment blocker only. It must not be reported as a code failure or as a successful build.

## Scope of this gate

A debug APK PASS proves compilation and packaging of the current checkout. It does **not** prove:

- Play production signing lineage;
- production Firebase credentials or FCM delivery;
- Google Play upload acceptance;
- physical-device GPS/background/POD/offline behavior;
- the full 15/15 E2E acceptance sequence.
