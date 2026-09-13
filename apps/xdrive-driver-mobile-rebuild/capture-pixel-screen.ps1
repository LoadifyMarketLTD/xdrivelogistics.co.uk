param(
  [Parameter(Mandatory = $true)]
  [string]$Name,
  [string]$OutputDirectory = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$AppRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $OutputDirectory) {
  $OutputDirectory = Join-Path $AppRoot 'pixel-screenshots'
}

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

$Adb = Resolve-Adb
$devices = @(& $Adb devices | Select-String "`tdevice$")
if ($env:ANDROID_SERIAL) {
  if (-not ($devices | Where-Object { $_.Line.StartsWith("$($env:ANDROID_SERIAL)`t") })) {
    throw "ANDROID_SERIAL=$($env:ANDROID_SERIAL) is not connected as an adb device."
  }
} elseif ($devices.Count -eq 0) {
  throw 'No Android device is connected through adb.'
} elseif ($devices.Count -gt 1) {
  throw 'More than one Android device is connected. Set ANDROID_SERIAL to the Pixel you want to use.'
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$SafeName = ($Name -replace '[^A-Za-z0-9._-]', '-').Trim('-')
if (-not $SafeName) { $SafeName = 'xdrive-screen' }
$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Remote = "/sdcard/xdrive-$Timestamp.png"
$Local = Join-Path $OutputDirectory "$Timestamp-$SafeName.png"

& $Adb shell screencap -p $Remote
if ($LASTEXITCODE -ne 0) { throw 'Pixel screenshot capture failed.' }

& $Adb pull $Remote $Local | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Pixel screenshot download failed.' }

& $Adb shell rm $Remote
Write-Host "Screenshot: $Local" -ForegroundColor Green
