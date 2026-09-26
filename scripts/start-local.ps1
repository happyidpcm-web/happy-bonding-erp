$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$databaseDir = Join-Path $projectRoot '.local\pgdata'
$pgCtl = Join-Path $projectRoot '.local\pgsql\bin\pg_ctl.exe'
if (!(Test-Path -LiteralPath $pgCtl) -or !(Test-Path -LiteralPath (Join-Path $databaseDir 'PG_VERSION'))) {
    throw 'Local PostgreSQL is not initialized in .local.'
}
& (Join-Path $projectRoot '.local\pgsql\bin\pg_isready.exe') -h 127.0.0.1 -p 5432 *> $null
if ($LASTEXITCODE -ne 0) {
    & $pgCtl -D $databaseDir -l (Join-Path $projectRoot '.local\postgres.log') -w start
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL failed to start. See .local\postgres.log.' }
}
function Test-Endpoint([string] $Url) {
    try { return (Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch { return $false }
}
$node = (Get-Command node.exe).Source
if (!(Test-Endpoint 'http://127.0.0.1:4000/api/health')) {
    Start-Process -FilePath $node -ArgumentList @('"node_modules/tsx/dist/cli.mjs"', '"server/index.ts"') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput '.local\api.log' -RedirectStandardError '.local\api-error.log'
}
if (!(Test-Endpoint 'http://127.0.0.1:5173')) {
    Start-Process -FilePath $node -ArgumentList @('"node_modules/vite/bin/vite.js"', '--config', 'vite.config.ts', '--host', '127.0.0.1', '--strictPort') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput '.local\web.log' -RedirectStandardError '.local\web-error.log'
}
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    if ((Test-Endpoint 'http://127.0.0.1:4000/api/health') -and (Test-Endpoint 'http://127.0.0.1:5173')) {
        Write-Host 'Happy Bonding ERP is ready: http://localhost:5173'
        exit 0
    }
    Start-Sleep -Seconds 1
}
throw 'Startup timed out. Check logs in .local.'
