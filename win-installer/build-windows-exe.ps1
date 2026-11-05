$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
$distDir = Join-Path $rootDir "dist"
$releaseDir = Join-Path $rootDir "release"
$zipPath = Join-Path $PSScriptRoot "WebAssets.zip"
$cscPath = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"

if (-not (Test-Path $distDir)) {
    throw "dist folder not found. Run npm run build first."
}

New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

$distDownloads = Join-Path $distDir "downloads"
if (Test-Path $distDownloads) {
    Remove-Item $distDownloads -Recurse -Force
}

Write-Host "[1/4] Packaging production web assets into WebAssets.zip..."
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($distDir, $zipPath)

$portableOut = Join-Path $releaseDir "OfficeAttendanceTracker-Portable.exe"
$portableSrc = Join-Path $PSScriptRoot "PortableServer.cs"

Write-Host "[2/4] Compiling standalone OfficeAttendanceTracker-Portable.exe..."
& $cscPath /target:winexe /optimize+ `
    /out:$portableOut `
    /r:System.dll `
    /r:System.Drawing.dll `
    /r:System.Windows.Forms.dll `
    /r:System.IO.Compression.dll `
    /r:System.IO.Compression.FileSystem.dll `
    "/resource:$zipPath,WebAssets.zip" `
    $portableSrc

if ($LASTEXITCODE -ne 0) {
    throw "Failed to compile PortableServer.cs"
}

$setupOut = Join-Path $releaseDir "OfficeAttendanceTracker-Setup.exe"
$setupSrc = Join-Path $PSScriptRoot "SetupWizard.cs"

Write-Host "[3/4] Compiling Windows Installer OfficeAttendanceTracker-Setup.exe..."
& $cscPath /target:winexe /optimize+ `
    /out:$setupOut `
    /r:System.dll `
    /r:System.Drawing.dll `
    /r:System.Windows.Forms.dll `
    "/resource:$portableOut,PortableApp.exe" `
    $setupSrc

if ($LASTEXITCODE -ne 0) {
    throw "Failed to compile SetupWizard.cs"
}

Write-Host "[4/4] Copying executables to workspace root and dist/downloads..."
Copy-Item $portableOut (Join-Path $rootDir "OfficeAttendanceTracker-Portable.exe") -Force
Copy-Item $setupOut (Join-Path $rootDir "OfficeAttendanceTracker-Setup.exe") -Force

$distDownloads = Join-Path $distDir "downloads"
New-Item -ItemType Directory -Force -Path $distDownloads | Out-Null
Copy-Item $portableOut (Join-Path $distDownloads "OfficeAttendanceTracker-Portable.exe") -Force
Copy-Item $setupOut (Join-Path $distDownloads "OfficeAttendanceTracker-Setup.exe") -Force

Write-Host "Successfully built standalone Windows executables!"
Get-ChildItem $releaseDir | Select-Object Name, Length
