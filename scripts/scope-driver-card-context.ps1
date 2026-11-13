$ErrorActionPreference='Stop'
$d=Split-Path $PSScriptRoot -Parent
$components=@(
  @{File='app\components\workspace\CxLoadCard.tsx';Anchor="  dataState,`n";TypeAnchor="  dataState?: string;`n";Context='<XDriveCardContext type="Freight load" reference={loadId} status={band} variant="load" />'},
  @{File='app\components\workspace\CxQuoteCard.tsx';Anchor="  footer,`n";TypeAnchor="  footer: ReactNode;`n";Context='<XDriveCardContext type="Freight quote" reference={loadId} status={stage ?? band} variant="quote" />'},
  @{File='app\components\workspace\CxDiaryCard.tsx';Anchor="  dataStage,`n";TypeAnchor="  dataStage?: string;`n";Context='<XDriveCardContext type="Transport record" reference={loadId} status={band} variant="diary" />'}
)
foreach($t in $components) {
  $p=Join-Path $d $t.File;$s=[IO.File]::ReadAllText($p).Replace("`r`n","`n")
  if(-not $s.Contains($t.Anchor) -or -not $s.Contains($t.TypeAnchor) -or -not $s.Contains($t.Context)){throw "Anchor missing: $p"}
  $s=$s.Replace($t.Anchor,$t.Anchor+"  showXDriveContext = false,`n")
  $s=$s.Replace($t.TypeAnchor,$t.TypeAnchor+"  showXDriveContext?: boolean;`n")
  $s=$s.Replace($t.Context,'{showXDriveContext ? '+$t.Context+' : null}')
  [IO.File]::WriteAllText($p,$s,[Text.UTF8Encoding]::new($false))
}
$pages=@('app\driver\loads\page.tsx','app\driver\quotes\page.tsx','app\driver\history\page.tsx')
$tags=@('<CxLoadCard','<CxQuoteCard','<CxDiaryCard')
for($i=0;$i -lt $pages.Count;$i++){
  $p=Join-Path $d $pages[$i];$s=[IO.File]::ReadAllText($p).Replace("`r`n","`n")
  $count=([regex]::Matches($s,[regex]::Escape($tags[$i]))).Count
  if($count -ne 1){throw "Unexpected tag occurrences: $($pages[$i])=$count"}
  $s=$s.Replace($tags[$i],$tags[$i]+' showXDriveContext')
  [IO.File]::WriteAllText($p,$s,[Text.UTF8Encoding]::new($false))
  Write-Output "Scoped $($pages[$i])"
}
