param([switch]$DryRun,[switch]$HoldLock,[switch]$SimulateInterrupted)
$ErrorActionPreference='Stop'
$root='D:\XDrive-Driver-Real-Integration-20261029'
$control=Join-Path $root 'automation'
$state=Join-Path $control 'state'
$logs=Join-Path $control 'logs'
$mutex=[System.Threading.Mutex]::new($false,'Local\XDriveDriverRealIntegrationWatchdog20261029')
$acquired=$false
try {
 $acquired=$mutex.WaitOne(0)
 if(-not $acquired){ Add-Content (Join-Path $logs 'watchdog.log') ((Get-Date -Format o)+' SKIP_DUPLICATE');exit 0 }
 $now=Get-Date -Format o
 $log=Join-Path $logs 'watchdog.log'
 function Log([string]$message){Add-Content -LiteralPath $log -Value ((Get-Date -Format o)+' '+$message)}
 Log 'START'
 if($HoldLock){Log 'LOCK_HELD_TEST';Start-Sleep -Seconds 12;Log 'LOCK_RELEASE_TEST';return}
 $projects=@(
  'D:\XDrive-Bookings-Showcase-20261029',
  'D:\XDrive-Booking-11-Sandbox',
  $root
 )
 foreach($p in $projects){if(-not(Test-Path -LiteralPath $p)){throw 'Missing project '+$p}}
 $git='C:\Program Files\Git\cmd\git.exe'
 $branch=(& $git -C $root branch --show-current | Out-String).Trim()
 $commit=(& $git -C $root rev-parse --short HEAD | Out-String).Trim()
 if($branch -ne 'integrate/xdrive-driver-real-20261029'){throw 'Unexpected active branch '+$branch}
 $changed=@(& $git -C $root status --porcelain)
 $checkpoint=Join-Path $root 'AUTONOMOUS_EXECUTION_CHECKPOINT.md'
 if(-not(Test-Path $checkpoint)){throw 'Checkpoint missing'}
 $checkpointText=Get-Content $checkpoint -Raw
 if($checkpointText -notmatch 'NEXT_ACTION:'){throw 'Checkpoint NEXT_ACTION missing'}
 $runStatePath=Join-Path $state 'run-state.json'
 $previous=$null
 if(Test-Path $runStatePath){try{$previous=Get-Content $runStatePath -Raw | ConvertFrom-Json}catch{Log 'PREVIOUS_STATE_INVALID'}}
 if($SimulateInterrupted){@{phase='running';started='2026-10-28T00:00:00Z';pid=999999;task='static-verification'}|ConvertTo-Json|Set-Content $runStatePath; $previous=Get-Content $runStatePath -Raw|ConvertFrom-Json}
 if($previous -and $previous.phase -eq 'running'){
  $old=$null;try{$old=[datetime]$previous.started}catch{}
  $alive=Get-Process -Id ([int]$previous.pid) -ErrorAction SilentlyContinue
  if($alive){Log ('RUNNER_ACTIVE pid='+$previous.pid+' task='+$previous.task);return}
  Log ('RECOVER_INTERRUPTED old_pid='+$previous.pid+' old_task='+$previous.task)
 }
 $runner=@{phase='running';started=(Get-Date -Format o);pid=$PID;task='static-verification';branch=$branch;commit=$commit}
 $runner|ConvertTo-Json|Set-Content $runStatePath
 if($DryRun){Log 'DRYRUN_READ_CHECKPOINT';$result='dry-run passed'}
 else {
   & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $control 'run-queue.ps1') -Root $root | ForEach-Object { Log ('QUEUE '+$_) };
   if ($LASTEXITCODE -ne 0) { Log ('QUEUE_CHECK_EXIT='+$LASTEXITCODE) }
   # Deterministic authorised executor: lint only changed PWA files. It cannot invent implementation steps.
   $targets=@($changed|ForEach-Object {if($_ -match '^.. (app/driver-pwa-fresh/.*\.tsx)$'){$Matches[1]}}|Where-Object {Test-Path (Join-Path $root $_)})
   if($targets.Count -gt 0){
    $eslint=Join-Path $root 'node_modules\.bin\eslint.cmd'
    $output=Join-Path $logs ('lint-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.log')
    $args=@($targets|Select-Object -Unique)
    Push-Location $root
    try{& $eslint @args *> $output;$code=$LASTEXITCODE}finally{Pop-Location}
    Log ('LINT_RESULT exit='+$code+' count='+$targets.Count+' output='+$output)
    $result=if($code -eq 0){'lint passed'}else{'lint failed; review log before code changes'}
   } else {$result='no changed PWA TSX files to lint';Log 'NO_CHANGED_TSX'}
 }
 $done=@{phase='idle';lastChecked=(Get-Date -Format o);pid=0;task='static-verification';result=$result;branch=$branch;commit=$commit;changedFiles=$changed}
 $done|ConvertTo-Json -Depth 4|Set-Content $runStatePath
 Log ('DONE result='+$result+' changed='+$changed.Count)
} catch {
 $message=$_.Exception.Message
 try{Log ('ERROR '+$message);@{phase='error';lastChecked=(Get-Date -Format o);error=$message;pid=0}|ConvertTo-Json|Set-Content (Join-Path $state 'run-state.json')}catch{}
 exit 1
}finally {
 if($acquired){$mutex.ReleaseMutex()}
 $mutex.Dispose()
}
