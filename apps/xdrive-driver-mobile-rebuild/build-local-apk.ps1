param(
  [switch]$SkipPrebuild,
  [switch]$Install,
  [switch]$Launch
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$AppRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $AppRoot
$PackageName = 'co.uk.xdrivelogistics.driver.preview'

function Resolve-Adb {
  $command = Get-Command adb -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }

  $candidates = @(
    $(if ($env:ANDROID_HOME) { Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe' }),
    $(if ($env:ANDROID_SDK_ROOT) { Join-Path $env:ANDROID_SDK_ROOT 'platform-tools\adb.exe' }),
    $(Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe')
  ) | Where-Object { $_ -and (Test-Path $_) }

  if ($candidates.Count -gt 0) { return $candidates[0] }
  throw 'adb.exe was not found. Install Android platform-tools or add adb to PATH.'
}

function Assert-OneAndroidDevice([string]$Adb) {
  $devices = @(& $Adb devices | Select-String "`tdevice$")
  if ($env:ANDROID_SERIAL) {
    if (-not ($devices | Where-Object { $_.Line.StartsWith("$($env:ANDROID_SERIAL)`t") })) {
      throw "ANDROID_SERIAL=$($env:ANDROID_SERIAL) is not connected as an adb device."
    }
    return
  }
  if ($devices.Count -eq 0) { throw 'No Android device is connected through adb.' }
  if ($devices.Count -gt 1) { throw 'More than one Android device is connected. Set ANDROID_SERIAL to the Pixel you want to use.' }
}

Write-Host '== XDrive Driver local validation ==' -ForegroundColor Cyan

if (-not (Test-Path (Join-Path $AppRoot 'node_modules'))) {
  Write-Host 'Installing mobile dependencies with npm ci...'
  npm ci
  if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
}

Write-Host 'Running TypeScript typecheck...'
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw 'TypeScript typecheck failed.' }

if (-not $SkipPrebuild) {
  Write-Host 'Generating Android project locally...'
  npx expo prebuild --platform android --no-install
  if ($LASTEXITCODE -ne 0) { throw 'Expo Android prebuild failed.' }
}

$AndroidRoot = Join-Path $AppRoot 'android'
$Gradle = Join-Path $AndroidRoot 'gradlew.bat'
if (-not (Test-Path $Gradle)) { throw "Gradle wrapper not found: $Gradle" }

Write-Host 'Building local Android debug APK...'
Push-Location $AndroidRoot
try {
  & $Gradle assembleDebug
  if ($LASTEXITCODE -ne 0) { throw 'Gradle assembleDebug failed.' }
} finally {
  Pop-Location
}

$Apk = Join-Path $AndroidRoot 'app\build\outputs\apk\debug\app-debug.apk'
if (-not (Test-Path $Apk)) { throw "APK was not produced: $Apk" }

$Hash = (Get-FileHash -Algorithm SHA256 $Apk).Hash
Write-Host "APK: $Apk" -ForegroundColor Green
Write-Host "SHA256: $Hash" -ForegroundColor Green

if ($Install -or $Launch) {
  $Adb = Resolve-Adb
  Assert-OneAndroidDevice $Adb

  if ($Install) {
    Write-Host 'Installing APK on the connected Pixel...'
    & $Adb install -r $Apk
    if ($LASTEXITCODE -ne 0) { throw 'adb install failed.' }
  }

  if ($Launch) {
    Write-Host 'Launching XDrive Driver Preview on the connected Pixel...'
    & $Adb shell am force-stop $PackageName
    & $Adb shell monkey -p $PackageName -c android.intent.category.LAUNCHER 1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'App launch through adb failed.' }
  }
}
