param(
  [string]$SemgrepVersion = '1.178.0'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path $PSScriptRoot -Parent
$toolRoot = Join-Path $repoRoot '.local-tools\semgrep-venv'
$semgrepExe = Join-Path $toolRoot 'Scripts\semgrep.exe'
$pythonExe = Join-Path $toolRoot 'Scripts\python.exe'
$resultDir = Join-Path $repoRoot '.sast'
$resultPath = Join-Path $resultDir 'semgrep-app.json'

Push-Location $repoRoot
try {
  $systemPython = Get-Command python -ErrorAction Stop
  if (-not (Test-Path $semgrepExe)) {
    Write-Host "Creating isolated Semgrep environment..." -ForegroundColor Cyan
    & $systemPython.Source -m venv $toolRoot
    if ($LASTEXITCODE -ne 0) { throw 'Failed to create Semgrep virtual environment.' }
  }

  $installedVersion = ''
  if (Test-Path $semgrepExe) {
    $installedVersion = (& $semgrepExe --version 2>$null).Trim()
  }
  if ($installedVersion -ne $SemgrepVersion) {
    Write-Host "Installing Semgrep $SemgrepVersion..." -ForegroundColor Cyan
    & $pythonExe -m pip install --disable-pip-version-check --quiet "semgrep==$SemgrepVersion"
    if ($LASTEXITCODE -ne 0) { throw 'Semgrep installation failed.' }
  }

  New-Item -ItemType Directory -Force $resultDir | Out-Null
  Write-Host "Running local application SAST with Semgrep $SemgrepVersion..." -ForegroundColor Cyan
  & $semgrepExe scan `
    --config p/ci `
    --error `
    --metrics=off `
    --exclude .github `
    --exclude node_modules `
    --exclude .next `
    --exclude .local-tools `
    --exclude test-results `
    --exclude playwright-report `
    --exclude coverage `
    --json-output $resultPath `
    .
  $scanExit = $LASTEXITCODE

  if (-not (Test-Path $resultPath)) {
    throw 'Semgrep did not produce a JSON report.'
  }
  $report = Get-Content $resultPath -Raw | ConvertFrom-Json
  $findingCount = @($report.results).Count
  $parserWarningCount = @($report.errors).Count

  Write-Host "SAST findings: $findingCount"
  Write-Host "Parser warnings: $parserWarningCount"
  Write-Host "Report: $resultPath"

  if ($scanExit -ne 0 -or $findingCount -ne 0) {
    Write-Host 'LOCAL_SAST=FAIL' -ForegroundColor Red
    exit 1
  }

  Write-Host 'LOCAL_SAST=PASS' -ForegroundColor Green
  exit 0
}
finally {
  Pop-Location
}
