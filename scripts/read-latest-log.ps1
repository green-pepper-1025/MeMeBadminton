param(
    [ValidateSet('all', 'build', 'runtime', 'error')]
    [string]$Kind = 'all',
    [int]$Tail = 120,
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$logsRoot = Join-Path $ProjectRoot 'logs'
$paths = if ($Kind -eq 'all') {
    @('build', 'runtime', 'error') | ForEach-Object { Join-Path $logsRoot $_ }
} else {
    @(Join-Path $logsRoot $Kind)
}

$latest = $paths |
    Where-Object { Test-Path $_ } |
    ForEach-Object { Get-ChildItem -Path $_ -Recurse -File -ErrorAction SilentlyContinue } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $latest) {
    Write-Output "No logs found under $logsRoot"
    exit 0
}

Write-Output "Latest log: $($latest.FullName)"
Get-Content -LiteralPath $latest.FullName -Tail $Tail
