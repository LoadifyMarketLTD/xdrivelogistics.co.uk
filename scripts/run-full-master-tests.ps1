Set-Location 'D:\XDrive-Master-Unification-20261104'
& .\node_modules\.bin\vitest.cmd run --maxWorkers=2 *> 'audit\VITEST_FULL_20261104.log'
Write-Output ('VITEST_EXIT=' + $LASTEXITCODE)
