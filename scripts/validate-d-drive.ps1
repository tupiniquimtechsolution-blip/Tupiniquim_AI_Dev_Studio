$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ExpectedRoot = 'D:\CODEX\Tupiniquim-AI-Dev-Studio'
if (-not $ProjectRoot.Equals($ExpectedRoot, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Projeto fora de $ExpectedRoot." }

$required = @(
  'D:\CODEX\programas\nodejs\node.exe',
  'D:\CODEX\programas\nodejs\corepack.cmd',
  'D:\CODEX\programas\pnpm\pnpm.cmd',
  'D:\CODEX\programas\dotnet\dotnet.exe'
)
foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Componente obrigatório local não encontrado: $path" }
}

$forbidden = @(
  (Join-Path $env:APPDATA 'Tupiniquim AI Dev Studio'),
  (Join-Path $env:LOCALAPPDATA 'Tupiniquim AI Dev Studio')
)
foreach ($path in $forbidden) {
  if (Test-Path -LiteralPath $path) { throw "Artefato do projeto encontrado fora de D:\CODEX: $path" }
}

git -c "safe.directory=$ExpectedRoot" check-ignore -q .env.local
if ($LASTEXITCODE -ne 0) { throw '.env.local não está ignorado pelo Git.' }
Write-Host 'Regra D:\CODEX-only e componentes locais validados.'
