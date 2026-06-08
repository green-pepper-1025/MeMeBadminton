param(
    [ValidateSet('web-desktop', 'web-mobile', 'android', 'ios', 'windows', 'mac')]
    [string]$Platform = 'web-desktop',
    [bool]$Debug = $true,
    [string]$CreatorPath = $env:COCOS_CREATOR,
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
if (Get-Variable PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
$logDir = Join-Path $ProjectRoot 'logs\build'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logFile = Join-Path $logDir "build-$Platform-$timestamp.log"

if (-not $CreatorPath) {
    $candidates = @(
        'D:\allTheApp\cocos\editors\Creator\3.8.8\CocosCreator.exe',
        'C:\Program Files\Cocos\Creator\3.8.8\CocosCreator.exe',
        'C:\Program Files\CocosCreator\Creator\3.8.8\CocosCreator.exe'
    )
    $CreatorPath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}

if (-not $CreatorPath -or -not (Test-Path $CreatorPath)) {
    "Cocos Creator executable not found. Set COCOS_CREATOR to CocosCreator.exe." | Tee-Object -FilePath $logFile
    exit 1
}

$debugText = if ($Debug) { 'true' } else { 'false' }
$buildArgs = "platform=$Platform;debug=$debugText;buildPath=build/$Platform"

"Running: $CreatorPath --project $ProjectRoot --build `"$buildArgs`"" | Tee-Object -FilePath $logFile
try {
    & $CreatorPath --project $ProjectRoot --build $buildArgs 2>&1 | Tee-Object -FilePath $logFile -Append
} catch {
    $_ | Out-String | Tee-Object -FilePath $logFile -Append
    $global:LASTEXITCODE = if ($LASTEXITCODE) { $LASTEXITCODE } else { 1 }
}
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
    $errorDir = Join-Path $ProjectRoot 'logs\error'
    New-Item -ItemType Directory -Force -Path $errorDir | Out-Null
    Copy-Item -LiteralPath $logFile -Destination (Join-Path $errorDir (Split-Path $logFile -Leaf)) -Force
}

exit $exitCode
