#!/usr/bin/env bash
set -euo pipefail

printf '\nXDrive Android local build gate\n'

if [[ ! -x ./gradlew ]]; then
  echo 'Run this script from android-native/. ./gradlew was not found or is not executable.' >&2
  exit 1
fi

printf '\n=== JAVA ===\n'
java -version

printf '\n=== GRADLE WRAPPER ===\n'
./gradlew --version

printf '\n=== CLEAN ===\n'
./gradlew clean --stacktrace

printf '\n=== UNIT TESTS ===\n'
./gradlew testDebugUnitTest --stacktrace

printf '\n=== DEBUG APK ===\n'
./gradlew assembleDebug --stacktrace

apk='./app/build/outputs/apk/debug/app-debug.apk'
if [[ ! -f "$apk" ]]; then
  echo "Gradle reported success but $apk does not exist." >&2
  exit 1
fi

printf '\n=== PASS ===\n'
printf 'APK: %s\n' "$apk"
printf 'Bytes: %s\n' "$(wc -c < "$apk" | tr -d ' ')"
printf 'SHA256: '
sha256sum "$apk" | awk '{print $1}'
echo 'This proves the current checkout compiled and produced a debug APK. It does not prove production signing, Firebase delivery, Play acceptance, or physical-device E2E.'
