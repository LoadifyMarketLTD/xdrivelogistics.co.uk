$file = 'C:\Users\xdriv\OneDrive\Desktop\XDRIVE-DRIVER-PWA-NEW-LOCAL\src\App.tsx'
$source = Get-Content $file -Raw
$old = 'onChange={e=>setPodName(e.target.value)} placeholder="Recipient name"'
$new = 'onChange={e=>{setPodName(e.target.value);setPodEvidence(false)}} placeholder="Recipient name"'
if (-not $source.Contains($old)) { throw 'Expected recipient field not found' }
$source = $source.Replace($old,$new)
Set-Content -Path $file -Value $source -Encoding UTF8
