param(
  [switch]$SkipPrebuild
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$AppRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $AppRoot

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
