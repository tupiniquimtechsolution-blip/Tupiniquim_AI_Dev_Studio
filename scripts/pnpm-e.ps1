$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ([System.IO.Path]::GetPathRoot($ProjectRoot).TrimEnd('\') -ne 'E:') { throw 'Execução recusada fora do disco E:.' }
$DataRoot = 'E:\Tupiniquim-AI-Dev-Studio.data'
$CacheRoot = Join-Path $DataRoot 'cache'
$TempRoot = Join-Path $DataRoot 'tmp'
$RuntimeRoot = Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\runtimes\cua_node'
$Runtime = Get-ChildItem -LiteralPath $RuntimeRoot -Directory | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
if ($null -eq $Runtime) { throw 'Runtime Node do Codex não encontrado.' }
$Bin = Join-Path $Runtime.FullName 'bin'
New-Item -ItemType Directory -Force -Path $CacheRoot, $TempRoot | Out-Null
$env:PATH = "$Bin;$env:PATH"
$env:TEMP = $TempRoot
$env:TMP = $TempRoot
$env:COREPACK_HOME = Join-Path $CacheRoot 'corepack'
$env:PNPM_HOME = Join-Path $CacheRoot 'pnpm-home'
$env:npm_config_cache = Join-Path $CacheRoot 'npm'
$env:ELECTRON_CACHE = Join-Path $CacheRoot 'electron'
$env:ELECTRON_BUILDER_CACHE = Join-Path $CacheRoot 'electron-builder'
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $CacheRoot 'playwright'
Set-Location $ProjectRoot
& (Join-Path $Bin 'corepack.cmd') pnpm @args
exit $LASTEXITCODE
