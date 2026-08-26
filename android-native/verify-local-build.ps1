$ErrorActionPreference = 'Stop'

Write-Host "XDrive Android local build gate" -ForegroundColor Cyan
Write-Host "Repository: $(Resolve-Path ..)"

if (-not (Test-Path ".\gradlew.bat")) {
  throw "Run this script from android-native/. gradlew.bat was not found."
}

Write-Host "`n=== JAVA ===" -ForegroundColor Cyan
& java -version
if ($LASTEXITCODE -ne 0) { throw "Java is unavailable." }

Write-Host "`n=== GRADLE WRAPPER ===" -ForegroundColor Cyan
& .\gradlew.bat --version
if ($LASTEXITCODE -ne 0) { throw "Gradle wrapper could not start." }

Write-Host "`n=== CLEAN ===" -ForegroundColor Cyan
& .\gradlew.bat clean --stacktrace
if ($LASTEXITCODE -ne 0) { throw "Gradle clean failed." }

Write-Host "`n=== UNIT TESTS ===" -ForegroundColor Cyan
& .\gradlew.bat testDebugUnitTest --stacktrace
if ($LASTEXITCODE -ne 0) { throw "Debug unit tests failed." }

Write-Host "`n=== DEBUG APK ===" -ForegroundColor Cyan
& .\gradlew.bat assembleDebug --stacktrace
if ($LASTEXITCODE -ne 0) { throw "assembleDebug failed." }

$apk = ".\app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $apk)) { throw "Gradle reported success but $apk does not exist." }

$hash = (Get-FileHash -Algorithm SHA256 $apk).Hash
$size = (Get-Item $apk).Length

Write-Host "`n=== PASS ===" -ForegroundColor Green
Write-Host "APK: $apk"
Write-Host "Bytes: $size"
Write-Host "SHA256: $hash"
Write-Host "This proves the current checkout compiled and produced a debug APK. It does not prove production signing, Firebase delivery, Play acceptance, or physical-device E2E."
