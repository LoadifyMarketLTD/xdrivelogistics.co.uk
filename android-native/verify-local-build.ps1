Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$sourceAndroidDir = $PSScriptRoot
$repoRoot = (Resolve-Path (Join-Path $sourceAndroidDir '..')).Path
Set-Location $sourceAndroidDir

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$evidenceDir = Join-Path $repoRoot "build\android-local-gate\$timestamp"
$gradleLog = Join-Path $evidenceDir 'gradle.log'
$diagnosticFile = Join-Path $evidenceDir 'diagnostic.txt'
$environmentFile = Join-Path $evidenceDir 'environment.txt'
$evidenceFile = Join-Path $evidenceDir 'LOCAL_BUILD_EVIDENCE.md'
$publishedApk = Join-Path $evidenceDir 'app-debug.apk'

New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null

$tempBase = [System.IO.Path]::GetTempPath()
$scratchRoot = Join-Path $tempBase "xdrive-android-gate-$timestamp"
$worktreeRoot = Join-Path $scratchRoot 'repo'
$worktreeAndroid = Join-Path $worktreeRoot 'android-native'
$worktreeCreated = $false

function Invoke-NativeCapture {
  param(
    [Parameter(Mandatory = $true)][scriptblock]$Command,
    [Parameter(Mandatory = $true)][string]$Label
  )

  $previousPreference = $ErrorActionPreference
  try {
    # Windows PowerShell 5.1 can surface native STDERR as PowerShell error
    # records. java -version intentionally writes to STDERR even on success.
    $ErrorActionPreference = 'Continue'
    $outputLines = @(& $Command 2>&1 | ForEach-Object { "$_" })
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousPreference
  }

  if ($null -eq $exitCode) { $exitCode = 0 }
  $output = ($outputLines -join [Environment]::NewLine).Trim()
  if ($exitCode -ne 0) {
    throw "$Label failed with exit code $exitCode.`n$output"
  }
  return $output
}

function Get-SourceIdentity {
  $branchValue = (& git -C $repoRoot branch --show-current 2>$null | Out-String).Trim()
  $headValue = (& git -C $repoRoot rev-parse HEAD 2>$null | Out-String).Trim()
  return @($branchValue, $headValue)
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
    'Unable to delete directory',
    'What went wrong',
    'FAILED',
    'BUILD FAILED',
    'Exception'
  )

  $diagnosticLines = @()
  if (Test-Path $gradleLog) {
    $diagnosticLines = @(Select-String -Path $gradleLog -Pattern $patterns |
      ForEach-Object { $_.Line.TrimEnd() } |
      Where-Object { $_ -and $_.Trim().Length -gt 0 } |
      Select-Object -Unique -First 250)
  }

  if ($diagnosticLines.Count -eq 0) {
    $diagnosticLines = @($Reason)
  }

  $identity = Get-SourceIdentity
  $branchValue = $identity[0]
  $headValue = $identity[1]

  @(
    'ANDROID LOCAL GATE: FAIL',
    "Reason: $Reason",
    "Gradle exit code: $ExitCode",
    '',
    'Extracted diagnostics:',
    $diagnosticLines
  ) | Set-Content -Path $diagnosticFile -Encoding UTF8

  @"
# XDrive Android Local Build Evidence

- Result: **FAIL**
- Timestamp: $timestamp
- Branch: $branchValue
- HEAD: $headValue
- Reason: $Reason
- Gradle exit code: $ExitCode
- Full Gradle log: $gradleLog
- Compact diagnostic: $diagnosticFile
- Environment: $environmentFile

This is a local Android binary-gate failure. It is not an E2E release verdict.
"@ | Set-Content -Path $evidenceFile -Encoding UTF8

  Write-Host "`nANDROID LOCAL GATE: FAIL" -ForegroundColor Red
  Write-Host "Reason: $Reason" -ForegroundColor Red
  Write-Host "`n=== EXTRACTED DIAGNOSTICS ===" -ForegroundColor Yellow
  $diagnosticLines | Select-Object -First 80 | ForEach-Object { Write-Host $_ }
  Write-Host "`nDiagnostic: $diagnosticFile" -ForegroundColor Yellow
  Write-Host "Full log:   $gradleLog" -ForegroundColor Yellow
  Write-Host "Evidence:   $evidenceFile" -ForegroundColor Yellow
}

function Remove-TemporaryWorktree {
  Set-Location $sourceAndroidDir
  if ($worktreeCreated -and (Test-Path $worktreeRoot)) {
    $previousPreference = $ErrorActionPreference
    try {
      $ErrorActionPreference = 'Continue'
      & git -C $repoRoot worktree remove --force $worktreeRoot 2>$null | Out-Null
    } finally {
      $ErrorActionPreference = $previousPreference
    }
  }
  if (Test-Path $scratchRoot) {
    Remove-Item -LiteralPath $scratchRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}

Write-Host 'XDrive Android one-command local gate' -ForegroundColor Cyan
Write-Host "Repository: $repoRoot"
Write-Host "Evidence:   $evidenceDir"
Write-Host "Scratch:    $scratchRoot"

if (-not (Test-Path (Join-Path $sourceAndroidDir 'gradlew.bat'))) {
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
  $identity = Get-SourceIdentity
  $branch = $identity[0]
  $head = $identity[1]
  $trackedStatus = (& git -C $repoRoot status --short --untracked-files=no 2>$null | Out-String).Trim()
  if ([string]::IsNullOrWhiteSpace($trackedStatus)) { $trackedStatus = '<clean>' }

  $javaVersion = Invoke-NativeCapture -Label 'Java' -Command { java -version }

  New-Item -ItemType Directory -Force -Path $scratchRoot | Out-Null
  $worktreeOutput = Invoke-NativeCapture -Label 'Temporary git worktree' -Command {
    git -C $repoRoot worktree add --detach $worktreeRoot $head
  }
  $worktreeCreated = $true

  $sourceLocalProperties = Join-Path $sourceAndroidDir 'local.properties'
  if (Test-Path $sourceLocalProperties) {
    Copy-Item $sourceLocalProperties (Join-Path $worktreeAndroid 'local.properties') -Force
  }

  Set-Location $worktreeAndroid
  $gradleVersion = Invoke-NativeCapture -Label 'Gradle wrapper' -Command { .\gradlew.bat --version }

  @"
XDrive Android local gate environment
Timestamp: $timestamp
Source repository: $repoRoot
Temporary worktree: $worktreeRoot
Branch: $branch
HEAD: $head
Tracked source status:
$trackedStatus

JAVA
$javaVersion

GRADLE
$gradleVersion

WORKTREE
$worktreeOutput
"@ | Set-Content -Path $environmentFile -Encoding UTF8
} catch {
  Write-FailureEvidence -Reason $_.Exception.Message
  Remove-TemporaryWorktree
  exit 1
}

$gradleArgs = @(
  ':app:compileDebugKotlin',
  'testDebugUnitTest',
  'lintDebug',
  'assembleDebug',
  '--no-daemon',
  '--console=plain',
  '--stacktrace'
)

Write-Host "`n=== ANDROID BINARY GATE ===" -ForegroundColor Cyan
Write-Host 'Running from a fresh temporary git worktree outside OneDrive.' -ForegroundColor DarkGray
Write-Host ".\gradlew.bat $($gradleArgs -join ' ')"
Write-Host 'The complete output is being saved automatically. No manual error hunting is required.' -ForegroundColor DarkGray

$previousPreference = $ErrorActionPreference
try {
  $ErrorActionPreference = 'Continue'
  & .\gradlew.bat @gradleArgs 2>&1 | Tee-Object -FilePath $gradleLog
  $gradleExit = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $previousPreference
}

if ($null -eq $gradleExit) { $gradleExit = 1 }
if ($gradleExit -ne 0) {
  Write-FailureEvidence -Reason 'Gradle compile/test/lint/APK gate failed.' -ExitCode $gradleExit
  Remove-TemporaryWorktree
  exit $gradleExit
}

$worktreeApk = Join-Path $worktreeAndroid 'app\build\outputs\apk\debug\app-debug.apk'
if (-not (Test-Path $worktreeApk)) {
  Write-FailureEvidence -Reason "Gradle reported success but $worktreeApk does not exist."
  Remove-TemporaryWorktree
  exit 1
}

Copy-Item $worktreeApk $publishedApk -Force
$apkItem = Get-Item $publishedApk
$hash = (Get-FileHash -Algorithm SHA256 $publishedApk).Hash
$size = $apkItem.Length
$resolvedApk = $apkItem.FullName

$lintReport = Join-Path $worktreeAndroid 'app\build\reports\lint-results-debug.txt'
if (Test-Path $lintReport) {
  Copy-Item $lintReport (Join-Path $evidenceDir 'lint-results-debug.txt') -Force
}

@"
# XDrive Android Local Build Evidence

- Result: **PASS**
- Timestamp: $timestamp
- Branch: $branch
- HEAD: $head
- Isolation: **fresh temporary git worktree outside OneDrive**
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

This proves the exact checkout passed the isolated local compile, unit-test, lint and debug-APK binary gate. It does **not** prove production signing, Firebase delivery, Play acceptance, server-side E2E evidence or physical-device E2E.
"@ | Set-Content -Path $evidenceFile -Encoding UTF8

Remove-TemporaryWorktree

Write-Host "`nANDROID LOCAL GATE: PASS" -ForegroundColor Green
Write-Host "HEAD:   $head"
Write-Host "APK:    $resolvedApk"
Write-Host "Bytes:  $size"
Write-Host "SHA256: $hash"
Write-Host "Evidence: $evidenceFile" -ForegroundColor Cyan
