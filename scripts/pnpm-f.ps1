. "$PSScriptRoot\rc1-environment.ps1"
$Pnpm = "$env:PNPM_HOME\pnpm.cmd"
if (-not (Test-Path $Pnpm)) { throw 'Execute .\scripts\setup-rc1-windows.ps1 primeiro.' }
& $Pnpm @args
exit $LASTEXITCODE
