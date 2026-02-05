# verify-windows-deps.ps1
# Checks if required FFmpeg DLLs are present for Windows Unity builds

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$x86_64Dir = Join-Path $scriptDir "x86_64"

Write-Host "=== FFmpeg RTMP Plugin Dependency Checker ===" -ForegroundColor Cyan
Write-Host "Checking: $x86_64Dir`n"

# Required files
$requiredDlls = @(
    @{ Name = "ffmpeg_rtmp.dll"; Required = $true; Description = "Main plugin DLL" }
)

# FFmpeg dependency patterns (version numbers vary)
$ffmpegPatterns = @(
    @{ Pattern = "avcodec-*.dll"; Required = $true; Description = "FFmpeg codec library" },
    @{ Pattern = "avformat-*.dll"; Required = $true; Description = "FFmpeg format library" },
    @{ Pattern = "avutil-*.dll"; Required = $true; Description = "FFmpeg utility library" },
    @{ Pattern = "swscale-*.dll"; Required = $true; Description = "FFmpeg scaling library" },
    @{ Pattern = "swresample-*.dll"; Required = $true; Description = "FFmpeg resampling library" }
)

# Optional but commonly needed
$optionalPatterns = @(
    @{ Pattern = "libx264-*.dll"; Required = $false; Description = "H.264 encoder" },
    @{ Pattern = "zlib*.dll"; Required = $false; Description = "Compression library" },
    @{ Pattern = "libssl-*.dll"; Required = $false; Description = "SSL/TLS for RTMPS" },
    @{ Pattern = "libcrypto-*.dll"; Required = $false; Description = "Crypto for RTMPS" }
)

$allOk = $true
$missingRequired = @()
$missingOptional = @()

# Check if x86_64 folder exists
if (-not (Test-Path $x86_64Dir)) {
    Write-Host "[ERROR] Plugins/x86_64/ folder not found!" -ForegroundColor Red
    exit 1
}

# Check exact-name DLLs
foreach ($dll in $requiredDlls) {
    $path = Join-Path $x86_64Dir $dll.Name
    if (Test-Path $path) {
        $size = (Get-Item $path).Length
        Write-Host "[OK] $($dll.Name) ($($dll.Description)) - $([math]::Round($size/1KB, 1)) KB" -ForegroundColor Green
    } else {
        Write-Host "[MISSING] $($dll.Name) ($($dll.Description))" -ForegroundColor Red
        $missingRequired += $dll.Name
        $allOk = $false
    }
}

# Check FFmpeg patterns
Write-Host "`nFFmpeg Dependencies:" -ForegroundColor Yellow
foreach ($pattern in $ffmpegPatterns) {
    $matches = Get-ChildItem -Path $x86_64Dir -Filter $pattern.Pattern -ErrorAction SilentlyContinue
    if ($matches) {
        foreach ($match in $matches) {
            $size = $match.Length
            Write-Host "[OK] $($match.Name) ($($pattern.Description)) - $([math]::Round($size/1KB, 1)) KB" -ForegroundColor Green
        }
    } else {
        Write-Host "[MISSING] $($pattern.Pattern) ($($pattern.Description))" -ForegroundColor Red
        $missingRequired += $pattern.Pattern
        $allOk = $false
    }
}

# Check optional patterns
Write-Host "`nOptional Dependencies:" -ForegroundColor Yellow
foreach ($pattern in $optionalPatterns) {
    $matches = Get-ChildItem -Path $x86_64Dir -Filter $pattern.Pattern -ErrorAction SilentlyContinue
    if ($matches) {
        foreach ($match in $matches) {
            Write-Host "[OK] $($match.Name) ($($pattern.Description))" -ForegroundColor Green
        }
    } else {
        Write-Host "[OPTIONAL] $($pattern.Pattern) ($($pattern.Description)) - may be needed for RTMPS" -ForegroundColor DarkYellow
        $missingOptional += $pattern.Pattern
    }
}

# Summary
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
if ($allOk) {
    Write-Host "All required DLLs present!" -ForegroundColor Green
    Write-Host "If streaming still fails, check Unity console for errors."
} else {
    Write-Host "Missing required DLLs:" -ForegroundColor Red
    foreach ($dll in $missingRequired) {
        Write-Host "  - $dll" -ForegroundColor Red
    }
    Write-Host "`nTo fix:"
    Write-Host "  1. Locate your FFmpeg installation's bin/ folder"
    Write-Host "  2. Copy all DLLs to: $x86_64Dir"
    Write-Host "  3. Restart Unity"
    Write-Host "`nFFmpeg sources:"
    Write-Host "  - vcpkg: <vcpkg-root>/installed/x64-windows/bin/"
    Write-Host "  - gyan.dev: ffmpeg-*-shared/bin/"
}

if ($missingOptional.Count -gt 0) {
    Write-Host "`nNote: Some optional DLLs are missing. These may be needed for:" -ForegroundColor DarkYellow
    Write-Host "  - RTMPS (SSL/TLS encrypted streaming)" -ForegroundColor DarkYellow
    Write-Host "  - H.264 encoding (libx264)" -ForegroundColor DarkYellow
}

Write-Host ""
