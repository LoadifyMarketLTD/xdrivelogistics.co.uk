param([Parameter(Mandatory=$true)][string]$Root)
$ErrorActionPreference='Stop'
$base=Join-Path $Root 'automation'
$path=Join-Path $base 'state\queue.json'
$log=Join-Path $base 'logs\queued-tasks.log'
if(-not(Test-Path $path)){Write-Output 'QUEUE_EMPTY';exit 0}
$queue=Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
$tasks=@($queue.tasks)
$task=$tasks|Where-Object {$_.status -eq 'pending' -or $_.status -eq 'running'}|Select-Object -First 1
if(-not $task){Write-Output 'QUEUE_COMPLETE';exit 0}
if($task.attempts -ge 2){$task.status='blocked';$queue|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $path;Write-Output 'QUEUE_RETRY_LIMIT';exit 2}
$script=[string]$task.script
if(-not $script.StartsWith('automation/tests/') -and -not $script.StartsWith('automation/tasks/')){throw 'Disallowed queue path'}
if($script -notmatch '^automation/(tests|tasks)/[A-Za-z0-9_-]+\.cjs$'){throw 'Invalid queue script path'}
$target=Join-Path $Root $script
if(-not(Test-Path -LiteralPath $target)){throw 'Missing queue script '+$script}
$task.status='running'
$task.attempts=[int]$task.attempts+1
$task|Add-Member -NotePropertyName lastStart -NotePropertyValue (Get-Date -Format o) -Force
$queue|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $path
Add-Content -LiteralPath $log -Value ((Get-Date -Format o)+' RUN id='+$task.id+' attempts='+$task.attempts)
$output=Join-Path $base ('logs\task-'+$task.id+'-'+(Get-Date -Format yyyyMMdd-HHmmss)+'.log')
Push-Location $Root
try{& 'C:\Program Files\nodejs\node.exe' $target *> $output;$code=$LASTEXITCODE}finally{Pop-Location}
if($code -eq 0){$task.status='complete';$task|Add-Member -NotePropertyName lastSuccess -NotePropertyValue (Get-Date -Format o) -Force}
else{$task.status=if($task.attempts -ge 2){'blocked'}else{'pending'};$task|Add-Member -NotePropertyName lastError -NotePropertyValue ("Exit $code") -Force}
$queue|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $path
Add-Content -LiteralPath $log -Value ((Get-Date -Format o)+' '+$task.status.ToUpper()+' id='+$task.id+' code='+$code+' log='+$output)
Write-Output ('QUEUE_'+$task.status.ToUpper()+' '+$task.id)
exit $code
