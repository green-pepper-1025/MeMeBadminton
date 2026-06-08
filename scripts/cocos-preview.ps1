param(
    [string]$CreatorPath = $env:COCOS_CREATOR,
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
$logDir = Join-Path $ProjectRoot 'logs\runtime'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logFile = Join-Path $logDir "preview-$timestamp.log"

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

"Opening project for preview: $ProjectRoot" | Tee-Object -FilePath $logFile
Start-Process -FilePath $CreatorPath -ArgumentList @('--project', $ProjectRoot) -WindowStyle Hidden
"Cocos Creator opened. Start preview from the editor or MCP preview tool when available." | Tee-Object -FilePath $logFile -Append
