Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Set-Location $PSScriptRoot

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$evidenceDir = Join-Path $repoRoot "build\android-local-gate\$timestamp"
$gradleLog = Join-Path $evidenceDir 'gradle.log'
$diagnosticFile = Join-Path $evidenceDir 'diagnostic.txt'
$environmentFile = Join-Path $evidenceDir 'environment.txt'
$evidenceFile = Join-Path $evidenceDir 'LOCAL_BUILD_EVIDENCE.md'

New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null

function Get-CommandOutput {
  param(
    [Parameter(Mandatory = $true)][scriptblock]$Command,
    [Parameter(Mandatory = $true)][string]$Label
  )

  $output = & $Command 2>&1 | Out-String
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    throw "$Label failed with exit code $exitCode.`n$output"
  }
  return $output.Trim()
}

function Write-FailureEvidence {
  param(
    [Parameter(Mandatory = $true)][string]$Reason,
    [int]$ExitCode = 1
  )

  $patterns = @(
    '^e: ',
    ' error: ',
    'Error:',
    'Unresolved reference',
    'incompatible version of Kotlin',
    'requires API level',
    'AssertionError',
    'Lint found',
    'Compilation error',
    'What went wrong',
    'FAILED',
    'BUILD FAILED',
    'Exception'
  )

  $diagnosticLines = @()
  if (Test-Path $gradleLog) {
    $diagnosticLines = Select-String -Path $gradleLog -Pattern $patterns |
      ForEach-Object { $_.Line.TrimEnd() } |
      Where-Object { $_ -and $_.Trim().Length -gt 0 } |
      Select-Object -Unique -First 250
  }

  if (-not $diagnosticLines -or $diagnosticLines.Count -eq 0) {
    $diagnosticLines = @($Reason)
  }

  @(
    "ANDROID LOCAL GATE: FAIL",
    "Reason: $Reason",
    "Gradle exit code: $ExitCode",
    '',
    'Extracted diagnostics:',
    $diagnosticLines
  ) | Set-Content -Path $diagnosticFile -Encoding UTF8

  $branch = (& git branch --show-current 2>$null | Out-String).Trim()
  $head = (& git rev-parse HEAD 2>$null | Out-String).Trim()

  @"
# XDrive Android Local Build Evidence

- Result: **FAIL**
- Timestamp: $timestamp
- Branch: $branch
- HEAD: $head
- Reason: $Reason
- Gradle exit code: $ExitCode
- Full Gradle log: $gradleLog
- Compact diagnostic: $diagnosticFile
- Environment: $environmentFile

This is a local Android binary-gate failure. It is not an E2E release verdict.
"@ | Set-Content -Path $evidenceFile -Encoding UTF8

  Write-Host "`nANDROID LOCAL GATE: FAIL" -ForegroundColor Red
  Write-Host "Diagnostic: $diagnosticFile" -ForegroundColor Yellow
  Write-Host "Full log:   $gradleLog" -ForegroundColor Yellow
  Write-Host "Evidence:   $evidenceFile" -ForegroundColor Yellow
}

Write-Host 'XDrive Android one-command local gate' -ForegroundColor Cyan
Write-Host "Repository: $repoRoot"
Write-Host "Evidence:   $evidenceDir"

if (-not (Test-Path '.\gradlew.bat')) {
  Write-FailureEvidence -Reason 'gradlew.bat was not found beside verify-local-build.ps1.'
  exit 1
}

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
  Write-FailureEvidence -Reason 'Java is unavailable on PATH.'
  exit 1
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-FailureEvidence -Reason 'Git is unavailable on PATH.'
  exit 1
}

try {
  $branch = (& git branch --show-current 2>$null | Out-String).Trim()
  $head = (& git rev-parse HEAD 2>$null | Out-String).Trim()
  $status = (& git status --short 2>$null | Out-String).Trim()
  if ([string]::IsNullOrWhiteSpace($status)) { $status = '<clean>' }

  $javaVersion = Get-CommandOutput -Label 'Java' -Command { java -version }
  $gradleVersion = Get-CommandOutput -Label 'Gradle wrapper' -Command { .\gradlew.bat --version }

  @"
XDrive Android local gate environment
Timestamp: $timestamp
Repository: $repoRoot
Branch: $branch
HEAD: $head
Git status:
$status

JAVA
$javaVersion

GRADLE
$gradleVersion
"@ | Set-Content -Path $environmentFile -Encoding UTF8
} catch {
  Write-FailureEvidence -Reason $_.Exception.Message
  exit 1
}

$gradleArgs = @(
  'clean',
  ':app:compileDebugKotlin',
  'testDebugUnitTest',
  'lintDebug',
  'assembleDebug',
  '--no-daemon',
  '--console=plain',
  '--stacktrace'
)

Write-Host "`n=== ANDROID BINARY GATE ===" -ForegroundColor Cyan
Write-Host ".\gradlew.bat $($gradleArgs -join ' ')"
Write-Host 'The complete output is being saved automatically. No manual error hunting is required.' -ForegroundColor DarkGray

& .\gradlew.bat @gradleArgs 2>&1 | Tee-Object -FilePath $gradleLog
$gradleExit = $LASTEXITCODE

if ($gradleExit -ne 0) {
  Write-FailureEvidence -Reason 'Gradle compile/test/lint/APK gate failed.' -ExitCode $gradleExit
  exit $gradleExit
}

$apk = '.\app\build\outputs\apk\debug\app-debug.apk'
if (-not (Test-Path $apk)) {
  Write-FailureEvidence -Reason "Gradle reported success but $apk does not exist."
  exit 1
}

$apkItem = Get-Item $apk
$hash = (Get-FileHash -Algorithm SHA256 $apk).Hash
$size = $apkItem.Length
$resolvedApk = $apkItem.FullName

$lintReport = Join-Path $PSScriptRoot 'app\build\reports\lint-results-debug.txt'
if (Test-Path $lintReport) {
  Copy-Item $lintReport (Join-Path $evidenceDir 'lint-results-debug.txt') -Force
}

@"
# XDrive Android Local Build Evidence

- Result: **PASS**
- Timestamp: $timestamp
- Branch: $branch
- HEAD: $head
- Command: `.\gradlew.bat $($gradleArgs -join ' ')`
- CompileDebugKotlin: **PASS**
- Debug unit tests: **PASS**
- lintDebug: **PASS**
- assembleDebug: **PASS**
- APK: $resolvedApk
- APK bytes: $size
- APK SHA-256: $hash
- Full Gradle log: $gradleLog
- Environment: $environmentFile

This proves the exact checkout passed the local compile, unit-test, lint and debug-APK binary gate. It does **not** prove production signing, Firebase delivery, Play acceptance, server-side E2E evidence or physical-device E2E.
"@ | Set-Content -Path $evidenceFile -Encoding UTF8

Write-Host "`nANDROID LOCAL GATE: PASS" -ForegroundColor Green
Write-Host "HEAD:   $head"
Write-Host "APK:    $resolvedApk"
Write-Host "Bytes:  $size"
Write-Host "SHA256: $hash"
Write-Host "Evidence: $evidenceFile" -ForegroundColor Cyan
