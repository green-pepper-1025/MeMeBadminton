param(
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
$logsRoot = Join-Path $ProjectRoot 'logs'
$errorDir = Join-Path $logsRoot 'error'
New-Item -ItemType Directory -Force -Path $errorDir | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outFile = Join-Path $errorDir "log-summary-$timestamp.log"

$sources = @(
    (Join-Path $logsRoot 'build'),
    (Join-Path $logsRoot 'runtime'),
    (Join-Path $logsRoot 'error'),
    (Join-Path $ProjectRoot 'temp')
)

"Log summary generated at $(Get-Date -Format o)" | Tee-Object -FilePath $outFile
foreach ($source in $sources) {
    if (Test-Path $source) {
        "`n## $source" | Tee-Object -FilePath $outFile -Append
        Get-ChildItem -Path $source -Recurse -File -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 20 FullName, LastWriteTime, Length |
            Format-Table -AutoSize | Out-String | Tee-Object -FilePath $outFile -Append
    }
}

Write-Output $outFile
