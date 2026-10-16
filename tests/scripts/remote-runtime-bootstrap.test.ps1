$ErrorActionPreference = 'Stop'

$Scripts = @(
  (Join-Path $PSScriptRoot '..\..\scripts\start-remote-runtime-gateway.ps1'),
  (Join-Path $PSScriptRoot '..\..\scripts\setup-remote-runtime-tunnel.ps1')
)

foreach ($Script in $Scripts) {
  $tokens = $null
  $errors = $null
  [System.Management.Automation.Language.Parser]::ParseFile($Script, [ref]$tokens, [ref]$errors) | Out-Null
  if ($errors.Count -gt 0) {
    $messages = ($errors | ForEach-Object Message | Out-String)
    throw ("PowerShell parse falhou para " + $Script + ": " + $messages)
  }

  $content = Get-Content -LiteralPath $Script -Raw
  if ($content -match 'Write-Host\s+.*TUPINIQUIM_GATEWAY_TOKEN') {
    throw ("Script pode imprimir token sensível: " + $Script)
  }
  if ($content -match 'REMOTE_RUNTIME_TOKEN\s*=\s*["'']') {
    throw ("Secret hardcoded detectado: " + $Script)
  }
}

Write-Host 'PASS Remote Runtime bootstrap scripts: parse clean + no obvious secret hardcode/output.'
