$ErrorActionPreference = 'Stop'

$Fixtures = @(
  (Join-Path $PSScriptRoot 'portable-layout.test.ps1'),
  (Join-Path $PSScriptRoot 'ollama-live-smoke.test.ps1')
)

foreach ($Fixture in $Fixtures) {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Fixture
  if ($LASTEXITCODE -ne 0) {
    throw "Windows script fixture falhou: $Fixture (exit=$LASTEXITCODE)"
  }
}

Write-Host 'PASS Windows RC1 script fixtures.'
