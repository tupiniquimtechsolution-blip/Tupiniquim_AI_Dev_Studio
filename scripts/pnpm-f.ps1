$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ExpectedRoot = 'F:\CODEX\Tupiniquim-AI-Dev-Studio'
if (-not $ProjectRoot.Equals($ExpectedRoot, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Execução recusada fora de $ExpectedRoot." }

$ProgramsRoot = 'F:\CODEX\programas'
$DataRoot = 'F:\CODEX\Tupiniquim-AI-Dev-Studio.data'
$CacheRoot = Join-Path $DataRoot 'cache'
$TempRoot = Join-Path $DataRoot 'tmp'
$NodeRoot = Join-Path $ProgramsRoot 'nodejs'
$Pnpm = Join-Path $ProgramsRoot 'pnpm\pnpm.cmd'
$DotnetRoot = Join-Path $ProgramsRoot 'dotnet'
if (-not (Test-Path -LiteralPath $Pnpm -PathType Leaf)) { throw "pnpm do SSD não encontrado em $Pnpm" }

New-Item -ItemType Directory -Force -Path $CacheRoot, $TempRoot | Out-Null
$env:PATH = "$NodeRoot;$DotnetRoot;$env:PATH"
$env:TEMP = $TempRoot
$env:TMP = $TempRoot
$env:COREPACK_HOME = Join-Path $ProgramsRoot 'corepack'
$env:PNPM_HOME = Join-Path $ProgramsRoot 'pnpm'
$env:npm_config_cache = Join-Path $ProgramsRoot 'npm-cache'
$env:npm_config_prefix = Join-Path $ProgramsRoot 'npm-global'
$env:PNPM_STORE_DIR = 'F:\CODEX\.pnpm-store'
$env:DOTNET_ROOT = $DotnetRoot
$env:DOTNET_CLI_HOME = Join-Path $ProgramsRoot 'dotnet-cli-home'
$env:NUGET_PACKAGES = Join-Path $ProgramsRoot 'nuget-packages'
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$env:CI = 'true'
$env:ELECTRON_CACHE = Join-Path $CacheRoot 'electron'
$env:ELECTRON_BUILDER_CACHE = Join-Path $CacheRoot 'electron-builder'
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $CacheRoot 'playwright'
Set-Location $ProjectRoot
& $Pnpm @args
exit $LASTEXITCODE
