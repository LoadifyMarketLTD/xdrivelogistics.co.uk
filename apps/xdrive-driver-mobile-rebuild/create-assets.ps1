$p = 'C:\Users\Danny\XDrive-Mobile-Rebuild-2026-09-07\repo\apps\xdrive-driver-mobile-rebuild\assets'
New-Item -ItemType Directory -Force -Path $p | Out-Null
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 1024,1024
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#2DA15F'))
$g.FillEllipse($brush,120,120,784,784)
$font = New-Object System.Drawing.Font('Arial',220,[System.Drawing.FontStyle]::Bold)
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = 'Center'
$sf.LineAlignment = 'Center'
$rect = New-Object System.Drawing.RectangleF(0,0,1024,1024)
$g.DrawString('XD',$font,[System.Drawing.Brushes]::White,$rect,$sf)
$bmp.Save((Join-Path $p 'icon.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Copy-Item (Join-Path $p 'icon.png') (Join-Path $p 'adaptive-icon.png') -Force
Write-Host 'assets created'