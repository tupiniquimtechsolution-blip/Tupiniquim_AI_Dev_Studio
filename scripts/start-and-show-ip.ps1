param(
  [switch]$InspectOnly
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ExpectedRoot = 'F:\CODEX\Tupiniquim-AI-Dev-Studio'
if (-not $ProjectRoot.Equals($ExpectedRoot, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Execução recusada fora de $ExpectedRoot." }
$Runner = Join-Path $ProjectRoot 'scripts\pnpm-f.ps1'
$LoopbackAddress = '127.0.0.1'
$RendererPort = 5173
$RendererUrl = 'http://{0}:{1}' -f $LoopbackAddress, $RendererPort

if (-not (Test-Path -LiteralPath $Runner -PathType Leaf)) {
  throw "Inicializador do projeto não encontrado em $Runner"
}

function Get-PrivateIpv4 {
  try {
    return @(
      Get-NetIPAddress -AddressFamily IPv4 -AddressState Preferred -ErrorAction Stop |
        Where-Object {
          $_.IPAddress -ne '127.0.0.1' -and
          -not $_.IPAddress.StartsWith('169.254.')
        } |
        Sort-Object InterfaceMetric, InterfaceIndex |
        Select-Object -ExpandProperty IPAddress -Unique
    )
  } catch {
    return @()
  }
}

function Test-RendererListening {
  try {
    return $null -ne (
      Get-NetTCPConnection -LocalAddress $LoopbackAddress -LocalPort $RendererPort -State Listen -ErrorAction Stop |
        Select-Object -First 1
    )
  } catch {
    return $false
  }
}

$privateAddresses = @(Get-PrivateIpv4)
$privateAddressText = if ($privateAddresses.Count -eq 0) { 'não detectado' } else { $privateAddresses -join ', ' }

Write-Host ''
Write-Host 'Tupiniquim AI Dev Studio' -ForegroundColor Green
Write-Host "Projeto: $ProjectRoot"
Write-Host "IPv4 da máquina (informativo): $privateAddressText"
Write-Host "Servidor privado do renderer: $RendererUrl"
Write-Host 'Acesso de rede: bloqueado; somente esta máquina pode abrir a URL.' -ForegroundColor Yellow
Write-Host ''

if ($InspectOnly) {
  $state = if (Test-RendererListening) { 'OUVINDO' } else { 'PARADO' }
  Write-Host ('Estado atual da porta {0}: {1}' -f $RendererPort, $state)
  exit 0
}

if (Test-RendererListening) {
  throw "A porta privada $RendererPort já está ocupada. Feche a instância anterior antes de iniciar outra."
}

$powerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$arguments = @(
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-File', $Runner,
  'dev'
)
$developmentProcess = Start-Process -FilePath $powerShell -ArgumentList $arguments -WorkingDirectory $ProjectRoot -NoNewWindow -PassThru

$deadline = [DateTime]::UtcNow.AddSeconds(60)
while ([DateTime]::UtcNow -lt $deadline) {
  $developmentProcess.Refresh()
  if ($developmentProcess.HasExited) {
    throw "O processo de desenvolvimento encerrou antes de abrir o servidor (código $($developmentProcess.ExitCode))."
  }
  if (Test-RendererListening) {
    Write-Host ''
    Write-Host "Aplicativo iniciado. Renderer ouvindo em $RendererUrl" -ForegroundColor Cyan
    Write-Host 'A janela Electron é a interface completa; a URL identifica o servidor local de desenvolvimento.'
    Write-Host 'Feche a janela do aplicativo ou pressione Ctrl+C para encerrar.'
    Write-Host ''
    break
  }
  Start-Sleep -Milliseconds 250
}

if (-not (Test-RendererListening)) {
  Write-Warning "O processo continua ativo, mas a porta $RendererPort não ficou disponível em 60 segundos."
}

Wait-Process -Id $developmentProcess.Id
$developmentProcess.Refresh()
exit $developmentProcess.ExitCode
