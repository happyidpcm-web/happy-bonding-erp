$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$databaseDir = Join-Path $projectRoot '.local\pgdata'
$pgCtl = Join-Path $projectRoot '.local\pgsql\bin\pg_ctl.exe'
function Test-DatabasePort {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $pending = $client.BeginConnect('127.0.0.1', 5432, $null, $null)
        if (!$pending.AsyncWaitHandle.WaitOne(2000)) { return $false }
        $client.EndConnect($pending)
        return $true
    } catch { return $false } finally { $client.Dispose() }
}
if (!(Test-DatabasePort)) {
    if (!(Test-Path -LiteralPath $pgCtl) -or !(Test-Path -LiteralPath (Join-Path $databaseDir 'PG_VERSION'))) {
        throw 'PostgreSQL is not running on port 5432 and local PostgreSQL is not initialized in .local.'
    }
    & $pgCtl -D $databaseDir -l (Join-Path $projectRoot '.local\postgres.log') -w start
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL failed to start. See .local\postgres.log.' }
}
function Test-Endpoint([string] $Url) {
    try { return (Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch { return $false }
}
$node = (Get-Command node.exe).Source
if (!(Test-Endpoint 'http://127.0.0.1:4000/api/health')) {
    $tsxCli = & $node -p "require.resolve('tsx/cli')"
    if ($LASTEXITCODE -ne 0) { throw 'Cannot find tsx. Run npm install first.' }
    Start-Process -FilePath $node -ArgumentList @(('"' + $tsxCli + '"'), '"server/index.ts"') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput '.local\api.log' -RedirectStandardError '.local\api-error.log'
}
if (!(Test-Endpoint 'http://127.0.0.1:5173')) {
    $vitePackage = & $node -p "require.resolve('vite/package.json')"
    if ($LASTEXITCODE -ne 0) { throw 'Cannot find Vite. Run npm install first.' }
    $viteCli = Join-Path (Split-Path -Parent $vitePackage) 'bin\vite.js'
    Start-Process -FilePath $node -ArgumentList @(('"' + $viteCli + '"'), '--config', 'vite.config.ts', '--host', '127.0.0.1', '--strictPort') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput '.local\web.log' -RedirectStandardError '.local\web-error.log'
}
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    if ((Test-Endpoint 'http://127.0.0.1:4000/api/health') -and (Test-Endpoint 'http://127.0.0.1:5173')) {
        Write-Host 'Happy Bonding ERP is ready: http://localhost:5173'
        exit 0
    }
    Start-Sleep -Seconds 1
}
throw 'Startup timed out. Check logs in .local.'
