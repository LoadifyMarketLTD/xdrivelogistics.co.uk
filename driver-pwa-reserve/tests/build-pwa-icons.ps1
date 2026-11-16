# Derive XDrive PWA icons from the user-approved XDrive logo already in the QA workspace.
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$root=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$root=Split-Path $PSScriptRoot -Parent
$source=Join-Path $root 'public\xdrive-logo-company-3150.png'
$destination=Join-Path $root 'public\icons'
New-Item -ItemType Directory -Force -Path $destination|Out-Null
$src=[System.Drawing.Image]::FromFile($source)
try {
  foreach($size in @(192,512)){
    $bitmap=New-Object System.Drawing.Bitmap($size,$size)
    try {
      $g=[System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $g.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.Clear([System.Drawing.Color]::FromArgb(7,26,66))
        # Crops only the owned XD lettermark, not the wide wordmark, preserving natural aspect ratio.
        $crop=New-Object System.Drawing.Rectangle(18,0,692,358)
        $w=[int]($size*0.81)
        $h=[int]($w*$crop.Height/$crop.Width)
        $x=[int](($size-$w)/2)
        $y=[int](($size-$h)/2)
        $rect=New-Object System.Drawing.Rectangle($x,$y,$w,$h)
        $g.DrawImage($src,$rect,$crop,[System.Drawing.GraphicsUnit]::Pixel)
      } finally {$g.Dispose()}
      $out=Join-Path $destination ('icon-'+$size+'x'+$size+'.png')
      $bitmap.Save($out,[System.Drawing.Imaging.ImageFormat]::Png)
      Write-Output ('CREATED '+$out)
    } finally {$bitmap.Dispose()}
  }
} finally {$src.Dispose()}
