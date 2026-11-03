param(
    [string]$SiteDir = ''
)

$ErrorActionPreference = 'Continue'

# 这个脚本放在 android/ 下运行；站点在仓库根目录
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$APP = Join-Path $ROOT 'app\src\main'
$OUT = Join-Path $ROOT 'out'

if (-not $SiteDir) {
    $SiteDir = (Resolve-Path (Join-Path $ROOT '..')).Path
}

$SDK = $env:ANDROID_SDK_ROOT
if (-not $SDK) { $SDK = $env:ANDROID_HOME }
if (-not $SDK) { $SDK = 'C:\AndroidSdk' }

$BT = Join-Path $SDK 'build-tools\34.0.0'
$PLATFORM = Join-Path $SDK 'platforms\android-34\android.jar'

$JAVAC = (Get-Command javac -ErrorAction SilentlyContinue).Source
if (-not $JAVAC) { Write-Host 'javac not found (install JDK 17+)'; exit 1 }
$KEYTOOL = Join-Path (Split-Path $JAVAC) 'keytool.exe'

foreach ($p in $BT, $PLATFORM, $KEYTOOL) {
    if (-not (Test-Path $p)) { Write-Host "MISSING: $p"; exit 1 }
}

Write-Host "site   : $SiteDir"
Write-Host "sdk    : $SDK"

# 0/8 把站点同步进 assets
Write-Host '0/8 sync site into assets'
$assets = Join-Path $APP 'assets\site'
if (Test-Path $assets) { Remove-Item $assets -Recurse -Force }
New-Item -ItemType Directory -Force $assets | Out-Null
foreach ($item in 'index.html', 'home.html', '404.html', 'robots.txt', '_headers', 'favicon.ico', 'css', 'js', 'g', 'assets') {
    $src = Join-Path $SiteDir $item
    if (Test-Path $src) { Copy-Item $src $assets -Recurse -Force }
}

New-Item -ItemType Directory -Force $OUT | Out-Null
Get-ChildItem $OUT -Recurse -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

$resZip = Join-Path $OUT 'res.zip'
$baseApk = Join-Path $OUT 'base.apk'
$classes = Join-Path $OUT 'classes'
$dexDir = Join-Path $OUT 'dex'
$aligned = Join-Path $OUT 'aligned.apk'
$apk = Join-Path $ROOT 'MINIGAME.apk'

Write-Host '1/8 aapt2 compile'
& (Join-Path $BT 'aapt2.exe') compile --dir (Join-Path $APP 'res') -o $resZip 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host 'aapt2 compile FAILED'; exit 1 }

Write-Host '2/8 aapt2 link'
& (Join-Path $BT 'aapt2.exe') link -o $baseApk -I $PLATFORM --manifest (Join-Path $APP 'AndroidManifest.xml') -A (Join-Path $APP 'assets') --auto-add-overlay $resZip 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host 'aapt2 link FAILED'; exit 1 }

Write-Host '3/8 fix asset path separators'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::Open($baseApk, 'Update')
$bad = @($zip.Entries | Where-Object { $_.FullName.Contains('\') } | ForEach-Object { $_.FullName })
foreach ($name in $bad) {
    $entry = $zip.GetEntry($name)
    $ms = New-Object System.IO.MemoryStream
    $s = $entry.Open()
    $s.CopyTo($ms)
    $s.Close()
    $bytes = $ms.ToArray()
    $ne = $zip.CreateEntry($name.Replace('\', '/'))
    $ns = $ne.Open()
    $ns.Write($bytes, 0, $bytes.Length)
    $ns.Close()
    $entry.Delete()
}
$zip.Dispose()
Write-Host ("   renamed " + $bad.Count + " entries")

Write-Host '4/8 javac'
New-Item -ItemType Directory -Force $classes | Out-Null
& $JAVAC --release 8 -nowarn -encoding UTF-8 -cp $PLATFORM -d $classes `
  (Join-Path $APP 'java\com\minigame\app\MainActivity.java') `
  (Join-Path $APP 'java\com\minigame\app\AppClient.java') `
  (Join-Path $APP 'java\com\minigame\app\ResumeCallback.java') `
  (Join-Path $APP 'java\com\minigame\app\ReloadTask.java') 2>&1 | Out-Null
if (-not (Test-Path (Join-Path $classes 'com\minigame\app\MainActivity.class'))) { Write-Host 'javac FAILED'; exit 1 }

Write-Host '5/8 d8'
New-Item -ItemType Directory -Force $dexDir | Out-Null
$classFiles = @(Get-ChildItem $classes -Recurse -Filter *.class | ForEach-Object { $_.FullName })
& (Join-Path $BT 'd8.bat') --lib $PLATFORM --min-api 24 --output $dexDir @classFiles 2>&1 | Out-Null
if (-not (Test-Path (Join-Path $dexDir 'classes.dex'))) { Write-Host 'd8 FAILED'; exit 1 }

Write-Host '6/8 add dex + zipalign'
$zip = [IO.Compression.ZipFile]::Open($baseApk, 'Update')
$entry = $zip.CreateEntry('classes.dex')
$es = $entry.Open()
$fs = [IO.File]::OpenRead((Join-Path $dexDir 'classes.dex'))
$fs.CopyTo($es)
$fs.Close()
$es.Close()
$zip.Dispose()

& (Join-Path $BT 'zipalign.exe') -f 4 $baseApk $aligned 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host 'zipalign FAILED'; exit 1 }

Write-Host '7/8 sign'
$ks = Join-Path $ROOT 'minigame.keystore'
if (-not (Test-Path $ks)) {
    Write-Host '   no keystore, creating one (keep it safe for future updates!)'
    & $KEYTOOL -genkeypair -keystore $ks -alias minigame -keyalg RSA -keysize 2048 -validity 10000 -storepass minigame123 -keypass minigame123 -dname "CN=MINIGAME, OU=Prank, O=MINIGAME, L=Local, C=CN" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Host 'keytool FAILED'; exit 1 }
}

& (Join-Path $BT 'apksigner.bat') sign --ks $ks --ks-pass pass:minigame123 --key-pass pass:minigame123 --out $apk $aligned 2>&1 | Out-Null
if (-not (Test-Path $apk)) { Write-Host 'apksigner FAILED'; exit 1 }

Write-Host ''
Write-Host ('DONE: ' + $apk + '  ' + [math]::Round((Get-Item $apk).Length / 1MB, 2) + ' MB')
