param(
  [string]$RepoUrl = 'https://github.com/LoadifyMarketLTD/xdrivelogistics.co.uk.git',
  [string]$Root = "$env:USERPROFILE\Desktop\XDrive-Local",
  [string]$Ref = 'main',
  [switch]$SkipInstall,
  [switch]$RunE2E
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][scriptblock]$Action
  )
  Write-Host "`n=== $Label ===" -ForegroundColor Cyan
  & $Action
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE"
  }
}

$mirrorDir = Join-Path $Root 'mirror\xdrivelogistics.co.uk.git'
$workDir = Join-Path $Root 'worktree\xdrivelogistics.co.uk'
$bundleDir = Join-Path $Root 'bundles'
$logDir = Join-Path $Root 'logs'

New-Item -ItemType Directory -Force -Path $Root, (Split-Path $mirrorDir), (Split-Path $workDir), $bundleDir, $logDir | Out-Null

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logPath = Join-Path $logDir "xdrive-local-gate-$stamp.log"
$vitestJsonPath = Join-Path $logDir "xdrive-vitest-$stamp.json"
$vitestFailurePath = Join-Path $logDir "xdrive-vitest-failures-$stamp.txt"
Start-Transcript -Path $logPath -Force | Out-Null

try {
  Write-Host 'XDRIVE_LOCAL_GATE=START' -ForegroundColor Green
  Write-Host "Root: $Root"
  Write-Host "Ref:  $Ref"
  Write-Host 'GitHub Actions required: NO'

  Invoke-Step 'Check git' { git --version }
  Invoke-Step 'Check node' { node --version }
  Invoke-Step 'Check npm' { npm --version }

  if (-not (Test-Path $mirrorDir)) {
    Invoke-Step 'Create full Git mirror backup' { git clone --mirror $RepoUrl $mirrorDir }
  } else {
    Invoke-Step 'Refresh full Git mirror backup' { git --git-dir=$mirrorDir remote update --prune }
  }

  $bundlePath = Join-Path $bundleDir "xdrivelogistics-$stamp.bundle"
  Invoke-Step 'Create timestamped Git bundle backup' {
    git --git-dir=$mirrorDir bundle create $bundlePath --all
  }

  if (-not (Test-Path $workDir)) {
    Invoke-Step 'Create working clone' { git -c core.autocrlf=false clone $RepoUrl $workDir }
  }

  Push-Location $workDir
  try {
    Invoke-Step 'Configure deterministic LF checkout' {
      git config core.autocrlf false
      git config core.eol lf
    }

    Invoke-Step 'Fetch repository refs' { git fetch --all --prune --tags }

    $remoteRef = "origin/$Ref"
    git rev-parse --verify $remoteRef *> $null
    if ($LASTEXITCODE -eq 0) {
      Invoke-Step "Checkout $remoteRef" { git checkout --detach --force $remoteRef }
    } else {
      Invoke-Step "Checkout $Ref" { git checkout --detach --force $Ref }
    }

    # The worktree may have been created previously with Windows CRLF conversion.
    # Re-materialise tracked files from the Git index after disabling autocrlf so
    # source-based contract tests see the same LF bytes as Netlify/Linux.
    Invoke-Step 'Normalize tracked worktree to LF bytes' { git reset --hard HEAD }

    $sha = (git rev-parse HEAD).Trim()
    Write-Host "Validated SHA: $sha" -ForegroundColor Yellow

    if (-not $SkipInstall) {
      Invoke-Step 'Install exact npm dependencies' { npm ci }
    } else {
      Write-Host 'Dependency install skipped by request.' -ForegroundColor DarkYellow
    }

    Invoke-Step 'Validate Supabase migration filenames and encoding' {
      node .github/scripts/validate-supabase-migration-files.mjs
    }

    Invoke-Step 'TypeScript typecheck' { npm run typecheck }

    Write-Host "`n=== Vitest unit suite ===" -ForegroundColor Cyan
    npm run test:unit
    $unitExit = $LASTEXITCODE
    if ($unitExit -ne 0) {
      Write-Host "Vitest failed; generating machine-readable failure report..." -ForegroundColor Yellow
      npx vitest run --reporter=json --outputFile="$vitestJsonPath" *> $null

      if (Test-Path $vitestJsonPath) {
        try {
          $report = Get-Content -Raw -Path $vitestJsonPath | ConvertFrom-Json
          $lines = New-Object System.Collections.Generic.List[string]
          $lines.Add("sha=$sha")
          $lines.Add("ref=$Ref")
          $lines.Add("vitest_exit=$unitExit")
          $lines.Add('')

          foreach ($suite in @($report.testResults)) {
            if ($suite.status -eq 'failed') {
              $lines.Add("FILE: $($suite.name)")
              foreach ($assertion in @($suite.assertionResults)) {
                if ($assertion.status -eq 'failed') {
                  $title = if ($assertion.fullName) { $assertion.fullName } else { $assertion.title }
                  $lines.Add("  FAIL: $title")
                  if ($assertion.failureMessages) {
                    $firstMessage = (@($assertion.failureMessages) | Select-Object -First 1)
                    if ($firstMessage) {
                      $cleanMessage = [regex]::Replace([string]$firstMessage, "`e\[[0-9;]*m", '')
                      $lines.Add("    $cleanMessage")
                    }
                  }
                }
              }
              $lines.Add('')
            }
          }
          $lines | Set-Content -Path $vitestFailurePath -Encoding UTF8
          Write-Host "Vitest failure summary: $vitestFailurePath" -ForegroundColor Yellow
          Write-Host "Vitest JSON report:    $vitestJsonPath" -ForegroundColor Yellow
        }
        catch {
          Write-Host "Vitest JSON exists but summary parsing failed: $($_.Exception.Message)" -ForegroundColor DarkYellow
          Write-Host "Vitest JSON report: $vitestJsonPath" -ForegroundColor Yellow
        }
      }

      throw "Vitest unit suite failed with exit code $unitExit"
    }

    Invoke-Step 'Next.js production build' { npm run build }

    if ($RunE2E) {
      Invoke-Step 'Playwright E2E suite' { npm run test:e2e }
    }

    $resultPath = Join-Path $logDir "xdrive-local-gate-$stamp.result.txt"
    @(
      'XDRIVE_LOCAL_GATE=PASS',
      "sha=$sha",
      "ref=$Ref",
      "bundle=$bundlePath",
      "log=$logPath",
      "e2e=$([bool]$RunE2E)",
      'github_actions_required=false'
    ) | Set-Content -Path $resultPath -Encoding UTF8

    Write-Host "`nXDRIVE_LOCAL_GATE=PASS" -ForegroundColor Green
    Write-Host "SHA:    $sha"
    Write-Host "Bundle: $bundlePath"
    Write-Host "Log:    $logPath"
  }
  finally {
    Pop-Location
  }
}
catch {
  Write-Host "`nXDRIVE_LOCAL_GATE=FAIL" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  throw
}
finally {
  Stop-Transcript | Out-Null
}
