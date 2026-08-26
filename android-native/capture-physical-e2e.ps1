param(
  [Parameter(Mandatory = $true)]
  [string]$ApkPath,
  [string]$OutputDir = ".\e2e-evidence"
)

$ErrorActionPreference = 'Stop'
$Package = 'co.uk.xdrivelogistics.driver'

if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
  throw 'adb was not found in PATH. Install Android platform-tools first.'
}
if (-not (Test-Path $ApkPath)) {
  throw "APK not found: $ApkPath"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$sessionDir = Join-Path $OutputDir $stamp
New-Item -ItemType Directory -Force -Path $sessionDir | Out-Null

Write-Host "XDrive physical E2E evidence: $sessionDir" -ForegroundColor Cyan

$devices = (& adb devices) | Out-String
$devices | Set-Content (Join-Path $sessionDir 'adb-devices.txt')
if ($devices -notmatch "`tdevice") {
  throw 'No authorized Android device is connected.'
}

(Get-FileHash -Algorithm SHA256 $ApkPath).Hash | Set-Content (Join-Path $sessionDir 'apk-sha256.txt')
(Get-Item $ApkPath).Length | Set-Content (Join-Path $sessionDir 'apk-bytes.txt')

& adb shell getprop ro.product.manufacturer | Set-Content (Join-Path $sessionDir 'device-manufacturer.txt')
& adb shell getprop ro.product.model | Set-Content (Join-Path $sessionDir 'device-model.txt')
& adb shell getprop ro.build.version.release | Set-Content (Join-Path $sessionDir 'android-version.txt')
& adb shell getprop ro.build.version.sdk | Set-Content (Join-Path $sessionDir 'android-sdk.txt')

Write-Host "`n=== INSTALL / UPDATE APK ===" -ForegroundColor Cyan
& adb install -r $ApkPath
if ($LASTEXITCODE -ne 0) { throw 'adb install failed.' }

Write-Host "`n=== PACKAGE METADATA ===" -ForegroundColor Cyan
& adb shell dumpsys package $Package | Select-String -Pattern 'versionCode=|versionName=|firstInstallTime=|lastUpdateTime=' | Set-Content (Join-Path $sessionDir 'package-version.txt')

Write-Host "`n=== CLEAR OLD LOGCAT ===" -ForegroundColor Cyan
& adb logcat -c

Write-Host "`n=== LAUNCH ===" -ForegroundColor Cyan
& adb shell monkey -p $Package -c android.intent.category.LAUNCHER 1 | Set-Content (Join-Path $sessionDir 'launch.txt')

Write-Host "`nRun the manual gates in PHYSICAL_E2E_ACCEPTANCE.md now." -ForegroundColor Yellow
Write-Host "When finished, press ENTER to capture final logs and package state."
Read-Host | Out-Null

Write-Host "`n=== CAPTURE LOGCAT ===" -ForegroundColor Cyan
& adb logcat -d -v threadtime | Set-Content (Join-Path $sessionDir 'logcat-full.txt')
Get-Content (Join-Path $sessionDir 'logcat-full.txt') |
  Select-String -Pattern 'FATAL EXCEPTION|ANR in |AndroidRuntime|XDrive|WorkManager|FirebaseMessaging|ForegroundService|SecurityException' |
  Set-Content (Join-Path $sessionDir 'logcat-focused.txt')

Write-Host "`n=== FINAL PACKAGE STATE ===" -ForegroundColor Cyan
& adb shell dumpsys package $Package | Set-Content (Join-Path $sessionDir 'package-dumpsys.txt')
& adb shell dumpsys jobscheduler $Package | Set-Content (Join-Path $sessionDir 'jobscheduler.txt')
& adb shell dumpsys activity services $Package | Set-Content (Join-Path $sessionDir 'services.txt')
& adb shell dumpsys notification --noredact | Select-String -Pattern 'xdrive|XDrive' | Set-Content (Join-Path $sessionDir 'notifications.txt')

@"
Physical E2E evidence directory: $sessionDir
APK: $ApkPath
Package: $Package
Captured: $(Get-Date -Format o)

This helper collects device/package/log evidence only. PASS/FAIL must still be recorded against every gate in PHYSICAL_E2E_ACCEPTANCE.md and correlated with server-side Supabase evidence.
"@ | Set-Content (Join-Path $sessionDir 'README.txt')

Write-Host "`nEvidence captured: $sessionDir" -ForegroundColor Green
