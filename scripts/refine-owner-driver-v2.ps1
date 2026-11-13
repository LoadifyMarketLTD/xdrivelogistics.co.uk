$ErrorActionPreference='Stop'
$d=Split-Path $PSScriptRoot -Parent
function Change([string]$path,[string]$before,[string]$after){
 $f=Join-Path $d $path
 $s=[IO.File]::ReadAllText($f)
 if(-not $s.Contains($before)){throw "Could not match C:\Users\xdriv\Desktop\XDrive-OwnerDriver-Redesign-20261113\scripts\refine-owner-driver-v2.ps1: $before"}
 $count=([regex]::Matches($s,[regex]::Escape($before))).Count
 if($count -ne 1){throw "Expected one occurrence in C:\Users\xdriv\Desktop\XDrive-OwnerDriver-Redesign-20261113\scripts\refine-owner-driver-v2.ps1, got $count"}
 [IO.File]::WriteAllText($f,$s.Replace($before,$after),[Text.UTF8Encoding]::new($false))
 Write-Output "UPDATED $path"
}
Change 'app\driver\history\page.tsx' "useState<'company' | 'mine'>('company')" "useState<'company' | 'mine'>('mine')"
Change 'app\driver\history\page.tsx' '<option value="company">Company Diary</option><option value="mine">My assigned jobs</option>' '{canViewCompanyDiary && <option value="company">Company Diary (all authorised company records)</option>}<option value="mine">My assigned jobs</option>'
