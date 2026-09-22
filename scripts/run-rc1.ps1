. "$PSScriptRoot\rc1-environment.ps1"
$Packaged = Join-Path $ProjectRoot 'release\win-unpacked\Tupiniquim AI Dev Studio.exe'
if (Test-Path $Packaged) { Start-Process $Packaged -WorkingDirectory $ProjectRoot; exit 0 }
if (-not (Test-Path 'out\main\index.js')) { throw 'Build ausente. Execute .\scripts\setup-rc1-windows.ps1.' }
Invoke-Checked "$env:PNPM_HOME\pnpm.cmd" @('exec','electron','.')
