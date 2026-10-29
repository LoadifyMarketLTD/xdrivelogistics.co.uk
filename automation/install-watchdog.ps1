param([switch]$RunNow)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$script=Join-Path $PSScriptRoot 'watchdog.ps1'
if(-not(Test-Path $script)){throw 'Watchdog missing'}
$task='XDrive-Driver-Real-Integration-Watchdog'
$cmd='powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$script+'"'
& schtasks.exe /Create /TN $task /SC HOURLY /MO 1 /TR $cmd /F
if($LASTEXITCODE -ne 0){throw 'Could not register scheduled task'}
if($RunNow){& schtasks.exe /Run /TN $task;if($LASTEXITCODE -ne 0){throw 'Could not start task'}}
Write-Output ('REGISTERED '+$task)
