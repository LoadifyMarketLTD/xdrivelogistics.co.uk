Set-Location 'C:\Users\xdriv\Desktop\XDrive-PR807-Main-Reconcile-20261114'
@('C:\Users\xdriv\OneDrive\Desktop\.env.test.txt','C:\Users\xdriv\OneDrive\Desktop\New Xdrive Logistics\XDrive-CX-Debug-PRESERVED-20261031\.env.development.local','C:\Users\xdriv\Desktop\XDrive-PR807-Carrier-Local.env') | ForEach-Object {
 if(Test-Path $_){Get-Content $_ | ForEach-Object {if($_ -match '^([A-Za-z_][A-Za-z_0-9]*)=(.*)$'){[Environment]::SetEnvironmentVariable($matches[1],$matches[2],'Process')}}}
}
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5299'
$env:E2E_BASE_URL=$env:PLAYWRIGHT_BASE_URL
$env:E2E_VISUAL_FIXTURE='false'
$env:E2E_ALLOW_PRODUCTION_MUTATION='false'
$env:CI='1'
node node_modules\@playwright\test\cli.js test e2e/pr807-authenticated-shell.spec.ts --project=chromium --workers=1 --retries=0 --reporter=line --grep 'Company / Carrier'
exit $LASTEXITCODE
