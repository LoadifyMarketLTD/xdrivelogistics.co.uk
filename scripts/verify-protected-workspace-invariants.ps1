Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$failures = New-Object System.Collections.Generic.List[string]

function Require-File {
    param([string]$Path)
    if (-not (Test-Path $Path -PathType Leaf)) {
        $failures.Add("Missing required file: $Path")
    }
}

function Require-Contains {
    param([string]$Path, [string]$Pattern, [string]$Message)
    Require-File $Path
    if ((Test-Path $Path -PathType Leaf) -and -not (Select-String -Path $Path -Pattern $Pattern -Quiet)) {
        $failures.Add($Message)
    }
}

function Require-NotContains {
    param([string]$Path, [string]$Pattern, [string]$Message)
    Require-File $Path
    if ((Test-Path $Path -PathType Leaf) -and (Select-String -Path $Path -Pattern $Pattern -Quiet)) {
        $failures.Add($Message)
    }
}

# GitHub Actions must stay disabled.
if (Test-Path '.github\workflows') {
    $workflowFiles = @(Get-ChildItem '.github\workflows' -File -ErrorAction SilentlyContinue)
    if ($workflowFiles.Count -gt 0) {
        $failures.Add('GitHub Actions workflows were reintroduced under .github/workflows.')
    }
}

# Live Availability map interaction.
$map = 'app\admin\fleet\FleetPositionMapClient.tsx'
Require-Contains $map 'scrollWheelZoom' 'Live Availability map lost mouse-wheel zoom.'
Require-NotContains $map 'scrollWheelZoom\s*=\s*\{false\}' 'Live Availability mouse-wheel zoom was explicitly disabled.'
Require-Contains $map 'map\.setView\(' 'Live Availability selected-driver auto-focus was removed.'
Require-Contains $map 'map\.fitBounds\(' 'Live Availability fitBounds behaviour was removed.'
Require-Contains $map '<Popup>' 'Live Availability marker popup was removed.'

# Directory protected functionality.
$directory = 'app\components\workspace\MemberDirectoryPage.tsx'
Require-Contains $directory 'toggleSavedCompany' 'Directory Saved Network toggle logic was removed.'
Require-Contains $directory 'Save Network' 'Directory Save Network action was removed.'
Require-Contains $directory 'Remove Saved' 'Directory Remove Saved action was removed.'
Require-Contains $directory 'savedNetworkError' 'Directory Saved Network error reporting was removed.'
Require-NotContains $directory "if \(pathname\.startsWith\('/driver'\)\)" 'Legacy separate Driver Directory branch was reintroduced.'

# Shared Directory route shells must stay free of duplicate PageHeader wrappers.
foreach ($route in @(
    'app\admin\marketplace\directory\page.tsx',
    'app\broker\carrier-network\directory\page.tsx',
    'app\customer\network\directory\page.tsx',
    'app\driver\directory\page.tsx'
)) {
    Require-Contains $route '<MemberDirectoryPage\s*/>' "Shared Directory component missing from $route."
    Require-NotContains $route '<PageHeader' "Duplicate Directory PageHeader reintroduced in $route."
}

# Readable operational typography.
$typography = 'app\components\workspace\workspace-readable-typography.css'
Require-Contains $typography '--ws-font-body:\s*14px' 'Operational body typography is no longer 14px.'
Require-Contains $typography '--ws-font-label:\s*14px' 'Operational label typography is no longer 14px.'
Require-Contains $typography '--ws-font-meta:\s*14px' 'Operational metadata typography is no longer 14px.'
Require-Contains $typography '--ws-font-section-title:\s*16px' 'Operational section title typography is no longer 16px.'
Require-Contains $typography '--ws-font-panel-title:\s*16px' 'Operational panel title typography is no longer 16px.'
$baselineTypography = 'app\components\workspace\workspace-measured-cx-baseline.css'
Require-Contains $baselineTypography '--ws-font-page-title:\s*20px' 'Operational page title typography is no longer 20px.'

# Global postcode/outcode area autodetect.
$postcodeResolver = 'app\components\workspace\OperationalPostcodeAreaResolver.tsx'
Require-Contains $postcodeResolver '/api/location/postcode-area\?q=' 'Global postcode/outcode area resolver was removed.'
Require-Contains 'app\components\workspace\TopWorkspaceShell.tsx' '<OperationalPostcodeAreaResolver />' 'Global postcode resolver is no longer mounted in the operational shell.'
Require-Contains 'app\api\location\postcode-area\route.ts' 'api\.postcodes\.io/outcodes/' 'UK outcode area resolution was removed.'

if ($failures.Count -gt 0) {
    Write-Host ''
    Write-Host 'XDRIVE PROTECTED INVARIANT GATE: FAIL' -ForegroundColor Red
    foreach ($failure in $failures) {
        Write-Host (' - ' + $failure) -ForegroundColor Red
    }
    exit 1
}

Write-Host 'XDRIVE PROTECTED INVARIANT GATE: PASS' -ForegroundColor Green
Write-Host ' - GitHub Actions remain disabled'
Write-Host ' - Live Availability map interaction protected'
Write-Host ' - Directory shared implementation and Saved Network protected'
Write-Host ' - Operational typography protected'
Write-Host ' - Global postcode/outcode area autodetect protected'
exit 0
