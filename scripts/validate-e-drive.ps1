$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ([System.IO.Path]::GetPathRoot($ProjectRoot).TrimEnd('\') -ne 'E:') { throw 'Projeto fora do disco E:.' }

$forbidden = @(
  (Join-Path $env:APPDATA 'Tupiniquim AI Dev Studio'),
  (Join-Path $env:LOCALAPPDATA 'Tupiniquim AI Dev Studio')
)
foreach ($path in $forbidden) {
  if (Test-Path -LiteralPath $path) { throw "Artefato do projeto encontrado fora de E: $path" }
}

git check-ignore -q .env.local
if ($LASTEXITCODE -ne 0) { throw '.env.local não está ignorado pelo Git.' }
Write-Host 'Regra E-only validada.'
