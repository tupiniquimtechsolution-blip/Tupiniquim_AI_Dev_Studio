param(
  [int]$Port = 43721,
  [string]$GatewayRoot = "$env:LOCALAPPDATA\Tupiniquim\RuntimeGateway",
  [string]$StateRoot = "$env:LOCALAPPDATA\Tupiniquim\RemoteRuntime"
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$TokenFile = Join-Path $StateRoot 'gateway-token.dpapi'
$StateFile = Join-Path $StateRoot 'gateway-state.json'

New-Item -ItemType Directory -Force -Path $StateRoot,$GatewayRoot | Out-Null

function ConvertFrom-ProtectedToken([string]$Path) {
  $secure = Get-Content -LiteralPath $Path -Raw | ConvertTo-SecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

if (Test-Path -LiteralPath $TokenFile) {
  $Token = ConvertFrom-ProtectedToken $TokenFile
} else {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $Token = -join ($bytes | ForEach-Object { $_.ToString('x2') })
  ConvertTo-SecureString $Token -AsPlainText -Force |
    ConvertFrom-SecureString |
    Set-Content -LiteralPath $TokenFile -Encoding ascii
}

if ($Token.Length -lt 24) { throw 'Token local inválido.' }

$pnpm = (Get-Command pnpm.cmd -ErrorAction Stop).Source
$psi = [Diagnostics.ProcessStartInfo]::new()
$psi.FileName = $pnpm
$psi.Arguments = 'runtime:gateway'
$psi.WorkingDirectory = $ProjectRoot
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$psi.Environment['TUPINIQUIM_GATEWAY_TOKEN'] = $Token
$psi.Environment['TUPINIQUIM_GATEWAY_HOST'] = '127.0.0.1'
$psi.Environment['TUPINIQUIM_GATEWAY_PORT'] = [string]$Port
$psi.Environment['TUPINIQUIM_GATEWAY_ROOT'] = $GatewayRoot

$process = [Diagnostics.Process]::Start($psi)
if ($null -eq $process) { throw 'Não foi possível iniciar o Runtime Gateway.' }

$headers = @{ Authorization = "Bearer $Token" }
$health = $null
for ($attempt = 1; $attempt -le 20; $attempt++) {
  Start-Sleep -Milliseconds 500
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -Headers $headers -TimeoutSec 3
    if ($health.ok -eq $true) { break }
  } catch {
    if ($process.HasExited) { throw "Runtime Gateway encerrou prematuramente (exit=$($process.ExitCode))." }
  }
}
if ($null -eq $health -or $health.ok -ne $true) {
  try { $process.Kill() } catch {}
  throw 'Runtime Gateway não ficou saudável na janela de espera.'
}

[pscustomobject]@{
  pid = $process.Id
  port = $Port
  gatewayRoot = $GatewayRoot
  tokenFile = $TokenFile
  startedAt = (Get-Date).ToUniversalTime().ToString('o')
} | ConvertTo-Json | Set-Content -LiteralPath $StateFile -Encoding utf8

Write-Host "TUPINIQUIM_RUNTIME_GATEWAY_READY"
Write-Host "PID=$($process.Id)"
Write-Host "LOCAL_URL=http://127.0.0.1:$Port"
Write-Host "PLATFORM=$($health.platform)"
Write-Host "CAPABILITIES=$([string]::Join(',', [string[]]$health.capabilities))"
Write-Host "TOKEN=PROTECTED_DPAPI_NOT_PRINTED"
Write-Host "STATE=$StateFile"
