param(
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
$logDir = Join-Path $ProjectRoot 'logs\error'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logFile = Join-Path $logDir "typecheck-$timestamp.log"

$localTsc = Join-Path $ProjectRoot 'node_modules\.bin\tsc.cmd'
$extensionTsc = Join-Path $ProjectRoot 'extensions\cocos-mcp-server\node_modules\.bin\tsc.cmd'

if (Test-Path $localTsc) {
    $tsc = $localTsc
} elseif (Test-Path $extensionTsc) {
    $tsc = $extensionTsc
} else {
    "TypeScript compiler not found. Run npm install in the project root." | Tee-Object -FilePath $logFile
    exit 1
}

& $tsc --noEmit --pretty false -p (Join-Path $ProjectRoot 'tsconfig.json') 2>&1 | Tee-Object -FilePath $logFile
exit $LASTEXITCODE
