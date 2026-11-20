param([string]$DeviceId)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$sdkPath = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
$adbPath = Join-Path $sdkPath 'platform-tools/adb.exe'
if (!(Test-Path $adbPath)) { throw 'Android SDK platform-tools not found.' }
$devices = @(& $adbPath devices | Select-String '^\S+\s+device$' | ForEach-Object { ($_.Line -split '\s+')[0] })
if (!$DeviceId) {
  if ($devices.Count -ne 1) { throw 'Connect one phone with USB debugging enabled, accept its authorization prompt, then retry. For multiple phones pass -DeviceId.' }
  $DeviceId = $devices[0]
}
if ($devices -notcontains $DeviceId) { throw 'The selected phone is not connected and authorized.' }
& $adbPath -s $DeviceId reverse tcp:5173 tcp:5173
if ($LASTEXITCODE -ne 0) { throw 'USB port forwarding failed.' }
Write-Host 'Run npm run dev -- --host 127.0.0.1 in another terminal first.'
Write-Host 'Installing a debug development app. Web changes reload over USB; native/icon changes require another run.'
& npx cap run android --live-reload --host localhost --port 5173 --target $DeviceId
if ($LASTEXITCODE -ne 0) { throw 'Android development launch failed.' }
