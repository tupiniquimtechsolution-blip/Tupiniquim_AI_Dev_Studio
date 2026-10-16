$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\portable-layout.ps1"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Layout = Get-TupiniquimPortableLayout -ProjectRoot $ProjectRoot
$ExpectedRoot = $Layout.ProjectRoot

$required = @(
  (Join-Path $Layout.NodeRoot 'node.exe'),
  (Join-Path $Layout.PnpmRoot 'pnpm.cmd')
)
foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Componente obrigatório local não encontrado: $path" }
}

$forbidden = @(
  (Join-Path $env:APPDATA 'Tupiniquim AI Dev Studio'),
  (Join-Path $env:LOCALAPPDATA 'Tupiniquim AI Dev Studio')
)
foreach ($path in $forbidden) {
  if (Test-Path -LiteralPath $path) { throw "Artefato do projeto encontrado fora de $($Layout.CodexRoot): $path" }
}

git -c "safe.directory=$ExpectedRoot" check-ignore -q .env.local
if ($LASTEXITCODE -ne 0) { throw '.env.local não está ignorado pelo Git.' }
Write-Host "Layout portátil validado em $($Layout.CodexRoot)."
