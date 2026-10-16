param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')]
  [string]$Hostname,
  [string]$TunnelName = 'tupiniquim-runtime',
  [int]$GatewayPort = 43721,
  [string]$StateRoot = "$env:LOCALAPPDATA\Tupiniquim\RemoteRuntime",
  [switch]$ConfigureWorkerSecret
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Cloudflared = (Get-Command cloudflared.exe -ErrorAction Stop).Source
$CloudflaredHome = Join-Path $env:USERPROFILE '.cloudflared'
$CertFile = Join-Path $CloudflaredHome 'cert.pem'
$TokenFile = Join-Path $StateRoot 'gateway-token.dpapi'
$StateFile = Join-Path $StateRoot 'tunnel-state.json'
$ConfigFile = Join-Path $CloudflaredHome 'config-tupiniquim-runtime.yml'

function Read-ProtectedToken([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Token protegido não encontrado. Execute primeiro scripts/start-remote-runtime-gateway.ps1."
  }
  $secure = Get-Content -LiteralPath $Path -Raw | ConvertTo-SecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

$Token = Read-ProtectedToken $TokenFile
$headers = @{ Authorization = "Bearer $Token" }
$localHealth = Invoke-RestMethod -Uri "http://127.0.0.1:$GatewayPort/health" -Headers $headers -TimeoutSec 5
if ($localHealth.ok -ne $true) { throw 'Runtime Gateway local não está saudável.' }

New-Item -ItemType Directory -Force -Path $CloudflaredHome,$StateRoot | Out-Null

if (-not (Test-Path -LiteralPath $CertFile)) {
  Write-Host 'CLOUDFLARED_LOGIN_REQUIRED: será aberto o navegador para autorizar a conta/zone.'
  & $Cloudflared tunnel login
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $CertFile)) {
    throw 'Cloudflare Tunnel login não foi concluído.'
  }
}

$listRaw = & $Cloudflared tunnel list --output json
if ($LASTEXITCODE -ne 0) { throw 'Falha ao listar Cloudflare Tunnels.' }
$tunnels = @($listRaw | ConvertFrom-Json)
$tunnel = $tunnels | Where-Object { $_.name -eq $TunnelName -and -not $_.deleted_at } | Select-Object -First 1

if ($null -eq $tunnel) {
  & $Cloudflared tunnel create $TunnelName
  if ($LASTEXITCODE -ne 0) { throw "Falha ao criar tunnel $TunnelName." }
  $listRaw = & $Cloudflared tunnel list --output json
  $tunnels = @($listRaw | ConvertFrom-Json)
  $tunnel = $tunnels | Where-Object { $_.name -eq $TunnelName -and -not $_.deleted_at } | Select-Object -First 1
}
if ($null -eq $tunnel -or [string]::IsNullOrWhiteSpace([string]$tunnel.id)) {
  throw "Tunnel $TunnelName não foi localizado após criação."
}

$TunnelId = [string]$tunnel.id
$CredentialsFile = Join-Path $CloudflaredHome "$TunnelId.json"
if (-not (Test-Path -LiteralPath $CredentialsFile)) {
  throw "Credentials file do tunnel não encontrado: $CredentialsFile"
}

$Yaml = @"
tunnel: $TunnelId
credentials-file: $($CredentialsFile -replace '\\','/')
ingress:
  - hostname: $Hostname
    service: http://127.0.0.1:$GatewayPort
  - service: http_status:404
"@
Set-Content -LiteralPath $ConfigFile -Value $Yaml -Encoding utf8

$routeOutput = & $Cloudflared tunnel route dns $TunnelId $Hostname 2>&1
if ($LASTEXITCODE -ne 0) {
  $text = ($routeOutput | Out-String)
  if ($text -notmatch 'already exists|already.*route|code: 81057') {
    throw "Falha ao criar/confirmar DNS do Tunnel: $text"
  }
}

$psi = [Diagnostics.ProcessStartInfo]::new()
$psi.FileName = $Cloudflared
$quote = [char]34
$psi.Arguments = "tunnel --config $quote$ConfigFile$quote run $TunnelId"
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$process = [Diagnostics.Process]::Start($psi)
if ($null -eq $process) { throw 'Não foi possível iniciar cloudflared.' }

$remoteHealth = $null
for ($attempt = 1; $attempt -le 30; $attempt++) {
  Start-Sleep -Seconds 1
  try {
    $remoteHealth = Invoke-RestMethod -Uri "https://$Hostname/health" -Headers $headers -TimeoutSec 5
    if ($remoteHealth.ok -eq $true) { break }
  } catch {
    if ($process.HasExited) { throw "cloudflared encerrou prematuramente (exit=$($process.ExitCode))." }
  }
}
if ($null -eq $remoteHealth -or $remoteHealth.ok -ne $true) {
  try { $process.Kill() } catch {}
  throw 'Tunnel não expôs um health autenticado dentro da janela de espera.'
}

$secretConfigured = $false
if ($ConfigureWorkerSecret) {
  $npx = (Get-Command npx.cmd -ErrorAction Stop).Source
  Write-Host 'Configurando REMOTE_RUNTIME_TOKEN no Worker sem imprimir o valor...'
  $Token | & $npx --yes wrangler@4 secret put REMOTE_RUNTIME_TOKEN --name tupiniquim-dev-ai-web
  if ($LASTEXITCODE -ne 0) { throw 'wrangler secret put REMOTE_RUNTIME_TOKEN falhou.' }
  $secretConfigured = $true
}

[pscustomobject]@{
  tunnelId = $TunnelId
  tunnelName = $TunnelName
  hostname = $Hostname
  publicUrl = "https://$Hostname"
  cloudflaredPid = $process.Id
  configFile = $ConfigFile
  workerSecretConfigured = $secretConfigured
  verifiedAt = (Get-Date).ToUniversalTime().ToString('o')
} | ConvertTo-Json | Set-Content -LiteralPath $StateFile -Encoding utf8

Write-Host 'TUPINIQUIM_RUNTIME_TUNNEL_READY'
Write-Host "REMOTE_RUNTIME_URL=https://$Hostname"
Write-Host "TUNNEL_ID=$TunnelId"
Write-Host "CLOUDFLARED_PID=$($process.Id)"
Write-Host "WORKER_SECRET_CONFIGURED=$secretConfigured"
Write-Host 'TOKEN=NOT_PRINTED'
Write-Host "STATE=$StateFile"
