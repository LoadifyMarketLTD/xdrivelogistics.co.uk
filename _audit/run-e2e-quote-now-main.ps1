$envFiles = @('D:\XDrive-CX-Debug\.env.development.local','C:\Users\xdriv\OneDrive\Desktop\.env.test.txt')
foreach ($envFile in $envFiles) {
  Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $idx = $line.IndexOf('=')
    if ($idx -lt 1) { return }
    [Environment]::SetEnvironmentVariable($line.Substring(0,$idx).Trim(), $line.Substring($idx+1), 'Process')
  }
}
Set-Location 'D:\XDrive-CX-Debug'
$env:PLAYWRIGHT_BASE_URL='https://www.xdrivelogistics.co.uk'
$env:E2E_BASE_URL='https://www.xdrivelogistics.co.uk'
Start-Sleep -Seconds 120
npx.cmd playwright test quote-now-identity-audit.spec.ts --project=chromium --workers=1 --reporter=line
exit $LASTEXITCODE
