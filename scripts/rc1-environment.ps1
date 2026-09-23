$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ($ProjectRoot -ine 'F:\CODEX\Tupiniquim-AI-Dev-Studio') { throw 'REQUIRES_WINDOWS_GATE: clone em F:\CODEX\Tupiniquim-AI-Dev-Studio.' }
$ProgramsRoot = 'F:\CODEX\programas'
$DataRoot = 'F:\CODEX\Tupiniquim-AI-Dev-Studio.data'
$CacheRoot = Join-Path $DataRoot 'cache'
$env:TEMP = Join-Path $DataRoot 'tmp'
$env:TMP = $env:TEMP
$env:PNPM_HOME = Join-Path $ProgramsRoot 'pnpm'
$env:npm_config_cache = Join-Path $CacheRoot 'npm'
$env:npm_config_store_dir = 'F:\CODEX\.pnpm-store'
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
