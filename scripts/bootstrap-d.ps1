$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ExpectedRoot = 'D:\CODEX\Tupiniquim-AI-Dev-Studio'
if (-not $ProjectRoot.Equals($ExpectedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Este projeto deve ser executado em $ExpectedRoot. Caminho atual: $ProjectRoot"
}

$ProgramsRoot = 'D:\CODEX\programas'
$DataRoot = 'D:\CODEX\Tupiniquim-AI-Dev-Studio.data'
$CacheRoot = Join-Path $DataRoot 'cache'
$TempRoot = Join-Path $DataRoot 'tmp'
$NodeRoot = Join-Path $ProgramsRoot 'nodejs'
$Node = Join-Path $NodeRoot 'node.exe'
$Corepack = Join-Path $NodeRoot 'corepack.cmd'
$Pnpm = Join-Path $ProgramsRoot 'pnpm\pnpm.cmd'
$DotnetRoot = Join-Path $ProgramsRoot 'dotnet'

if (-not (Test-Path -LiteralPath $Node -PathType Leaf)) { throw "Node.js local não encontrado em $Node" }
if (-not (Test-Path -LiteralPath $Corepack -PathType Leaf)) { throw "Corepack local não encontrado em $Corepack" }
if (-not (Test-Path -LiteralPath $Pnpm -PathType Leaf)) { throw "pnpm local não encontrado em $Pnpm" }
if (-not (Test-Path -LiteralPath (Join-Path $DotnetRoot 'dotnet.exe') -PathType Leaf)) { throw "SDK .NET/Visual Basic local não encontrado em $DotnetRoot" }

New-Item -ItemType Directory -Force -Path $CacheRoot, $TempRoot | Out-Null
$env:PATH = "$NodeRoot;$DotnetRoot;$env:PATH"
$env:TEMP = $TempRoot
$env:TMP = $TempRoot
$env:COREPACK_HOME = Join-Path $ProgramsRoot 'corepack'
$env:PNPM_HOME = Join-Path $ProgramsRoot 'pnpm'
$env:npm_config_cache = Join-Path $ProgramsRoot 'npm-cache'
$env:npm_config_prefix = Join-Path $ProgramsRoot 'npm-global'
$env:PNPM_STORE_DIR = 'D:\CODEX\.pnpm-store'
$env:DOTNET_ROOT = $DotnetRoot
$env:DOTNET_CLI_HOME = Join-Path $ProgramsRoot 'dotnet-cli-home'
$env:NUGET_PACKAGES = Join-Path $ProgramsRoot 'nuget-packages'
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$env:CI = 'true'
$env:ELECTRON_CACHE = Join-Path $CacheRoot 'electron'
$env:ELECTRON_BUILDER_CACHE = Join-Path $CacheRoot 'electron-builder'
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $CacheRoot 'playwright'

Set-Location $ProjectRoot
& $Pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { throw "pnpm install falhou com código $LASTEXITCODE" }

Write-Host 'Bootstrap concluído. Projeto, runtimes, caches, dados e temporários permanecem em D:\CODEX.'
