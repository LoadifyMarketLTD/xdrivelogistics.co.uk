param([string]$Root=(Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference='Stop'
Set-Location $Root
$routes=Get-ChildItem (Join-Path $Root 'app\admin') -Recurse -File -Filter 'page.tsx' | Sort-Object FullName
$rows=@()
foreach($f in $routes){
 $rel=$f.FullName.Substring($Root.Length+1).Replace('\','/')
 $route='/' + ($rel -replace '^app/','' -replace '/page.tsx$','' -replace '/\[([^]]+)\]','/{$1}')
 $raw=Get-Content -LiteralPath $f.FullName -Raw
 $legacy=($route -ne '/admin' -and $route -notmatch '^/admin/jobs/\{id\}$')
 $shell=if($route -eq '/admin'){'MasterWorkspace'}elseif($route -match '^/admin/jobs/\{id\}$'){'MasterWorkspace detail exception'}else{'TopWorkspaceShell'}
 $directSupabase=[bool]($raw -match "\.from\('")
 $api=[bool]($raw -match '/api/|fetch\(')
 $legacyUi=[bool]($raw -match 'style=\{|className=|<table|<form')
 $redirect=[bool]($raw -match "router\.push|redirect\(|window\.location")
 $actions=[bool]($raw -match 'onClick=|onSubmit=|method: .POST.|method: .DELETE.|method: .PATCH.')
 $rows += [pscustomobject]@{route=$route;file=$rel;shell=$shell;oldShell=$legacy;lines=($raw -split "`n").Count;directSupabase=$directSupabase;api=$api;customUI=$legacyUi;navigation=$redirect;actions=$actions}
}
$out=Join-Path $Root 'audit\admin-routes-20261104.csv'
New-Item (Split-Path $out) -ItemType Directory -Force | Out-Null
$rows | Export-Csv -Path $out -NoTypeInformation -Encoding UTF8
$other=@('admin','customer','broker','driver','fleet','owner-driver','dispatcher','super-admin','company-driver')
$roles=@()
foreach($name in $other){
 $folder=Join-Path $Root ('app\'+$name)
 if(Test-Path $folder){
  $layouts=Get-ChildItem $folder -File -Filter '*layout*' -ErrorAction SilentlyContinue
  $roles += [pscustomobject]@{role=$name;pages=(Get-ChildItem $folder -Recurse -Filter page.tsx -File | Measure-Object).Count;layouts=($layouts.Name -join '|')}
 }
}
$roles | Export-Csv -Path (Join-Path $Root 'audit\workspace-roles-20261104.csv') -NoTypeInformation -Encoding UTF8
Write-Output ('ADMIN_PAGES='+$rows.Count+' LEGACY_SHELL='+@($rows|Where-Object oldShell).Count+' WITH_ACTIONS='+@($rows|Where-Object actions).Count+' DIRECT_SUPABASE='+@($rows|Where-Object directSupabase).Count)
$rows | Group-Object shell | Select-Object Name,Count | Format-Table
$roles | Format-Table
