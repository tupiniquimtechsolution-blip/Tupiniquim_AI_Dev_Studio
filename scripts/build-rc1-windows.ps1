. "$PSScriptRoot\rc1-environment.ps1"
Invoke-Checked "$env:PNPM_HOME\pnpm.cmd" @('package:win')
if (-not (Test-Path 'release\win-unpacked\Tupiniquim AI Dev Studio.exe')) { throw 'Executavel esperado nao encontrado.' }
Write-Host "Pacote em $ProjectRoot\release"
