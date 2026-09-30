. "$PSScriptRoot\portable-layout.ps1"
$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Layout = Get-TupiniquimPortableLayout -ProjectRoot $ProjectRoot
$PortableDriveName = $Layout.DriveName
$PortableDriveRoot = $Layout.DriveRoot
$CodexRoot = $Layout.CodexRoot
$ProgramsRoot = $Layout.ProgramsRoot
$DataRoot = $Layout.DataRoot
$CacheRoot = $Layout.CacheRoot
$env:TEMP = $Layout.TempRoot
$env:TMP = $env:TEMP
$env:TUPINIQUIM_PORTABLE_DRIVE_ROOT = $PortableDriveRoot
$env:PNPM_HOME = $Layout.PnpmRoot
$env:npm_config_cache = Join-Path $CacheRoot 'npm'
$env:npm_config_store_dir = $Layout.PnpmStoreRoot
$env:PNPM_STORE_DIR = $Layout.PnpmStoreRoot
$env:ELECTRON_CACHE = Join-Path $CacheRoot 'electron'
$env:ELECTRON_BUILDER_CACHE = Join-Path $CacheRoot 'electron-builder'
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $CacheRoot 'playwright'
$env:PATH = "$ProgramsRoot\nodejs;$env:PNPM_HOME;$ProgramsRoot\ollama;$ProgramsRoot\git\cmd;$env:PATH"
New-Item -ItemType Directory -Force -Path $env:TEMP,$CacheRoot,$ProgramsRoot | Out-Null
Set-Location $ProjectRoot
function Invoke-Checked([string]$Program, [string[]]$Arguments) {
  & $Program @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Program falhou: codigo $LASTEXITCODE" }
}
