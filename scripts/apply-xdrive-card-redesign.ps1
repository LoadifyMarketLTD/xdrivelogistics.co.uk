$ErrorActionPreference = 'Stop'
$d = Split-Path $PSScriptRoot -Parent
$targets = @(
  @{Path='app\components\workspace\CxLoadCard.tsx'; Anchor='<div className="xdrive-cx-load-card__main">'; Context='<XDriveCardContext type="Freight load" reference={loadId} status={band} variant="load" />'},
  @{Path='app\components\workspace\CxQuoteCard.tsx'; Anchor='<div className="xdrive-cx-quote-card__main">'; Context='<XDriveCardContext type="Freight quote" reference={loadId} status={stage ?? band} variant="quote" />'},
  @{Path='app\components\workspace\CxDiaryCard.tsx'; Anchor='<div className="xdrive-cx-diary-card__main">'; Context='<XDriveCardContext type="Transport record" reference={loadId} status={band} variant="diary" />'}
)
foreach ($t in $targets) {
  $p = Join-Path $d $t.Path
  $s = [IO.File]::ReadAllText($p)
  $importAnchor = "import type { ReactNode } from 'react';"
  if (-not $s.Contains($importAnchor) -or -not $s.Contains($t.Anchor)) { throw "Anchor missing: $p" }
  if (-not $s.Contains("import XDriveCardContext")) {
    $s = $s.Replace($importAnchor, $importAnchor + "`nimport XDriveCardContext from './XDriveCardContext';")
  }
  if (-not $s.Contains($t.Context)) { $s = $s.Replace($t.Anchor, $t.Context + "`n      " + $t.Anchor) }
  [IO.File]::WriteAllText($p, $s, [Text.UTF8Encoding]::new($false))
  Write-Output "MODIFIED $($t.Path)"
}
$p = Join-Path $d 'app\driver\layout.tsx'
$s = [IO.File]::ReadAllText($p)
$anchor = "import './driver-mobile-readability-blueprint.css';"
if (-not $s.Contains($anchor)) { throw 'Missing layout anchor' }
if (-not $s.Contains("import './xdrive-operational-cards.css';")) {
  $s = $s.Replace($anchor, $anchor + "`nimport './xdrive-operational-cards.css';")
}
[IO.File]::WriteAllText($p, $s, [Text.UTF8Encoding]::new($false))
Write-Output 'MODIFIED app\driver\layout.tsx'
