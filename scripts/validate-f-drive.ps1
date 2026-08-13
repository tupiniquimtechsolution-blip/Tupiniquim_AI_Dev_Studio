$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ExpectedRoot = 'F:\CODEX\Tupiniquim-AI-Dev-Studio'
if (-not $ProjectRoot.Equals($ExpectedRoot, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Projeto fora de $ExpectedRoot." }

$required = @(
  'F:\CODEX\programas\nodejs\node.exe',
  'F:\CODEX\programas\nodejs\corepack.cmd',
  'F:\CODEX\programas\pnpm\pnpm.cmd',
  'F:\CODEX\programas\dotnet\dotnet.exe'
)
foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Componente obrigatório do SSD não encontrado: $path" }
}

$forbidden = @(
  (Join-Path $env:APPDATA 'Tupiniquim AI Dev Studio'),
  (Join-Path $env:LOCALAPPDATA 'Tupiniquim AI Dev Studio')
)
foreach ($path in $forbidden) {
  if (Test-Path -LiteralPath $path) { throw "Artefato do projeto encontrado fora de F:\CODEX: $path" }
}

git check-ignore -q .env.local
if ($LASTEXITCODE -ne 0) { throw '.env.local não está ignorado pelo Git.' }
Write-Host 'Regra F:\CODEX-only e componentes locais validados.'
